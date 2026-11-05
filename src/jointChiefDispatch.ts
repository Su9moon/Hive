import type { AgentMessage, ChatSnapshot, ManagedTab } from './contracts';
import type { NativeControlSnapshot } from './nativeControlLegacy';

const DISPATCH_PREFIX = 'HIVE06_CHIEF_DISPATCH_V1\n';
const RESULT_PREFIX = 'HIVE06_DEVELOPER_RESULT_V1\n';

export interface ChiefDirective {
  dispatchId: string;
  targetIdentity: 'hive-developer' | 'cb-developer';
  instruction: string;
}

export interface DeveloperResult {
  dispatchId: string;
  status: 'acknowledged' | 'completed' | 'blocked';
  summary: string;
  evidence: string[];
}

function exactRecord(value: unknown, expected: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid structured dispatch content');
  const obj = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(obj).sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error('Unexpected structured dispatch fields');
  }
  return obj;
}

/** A strict assistant-output envelope, never raw conversational prose or quoted Markdown. */
export function parseChiefDirective(text: string): ChiefDirective | null {
  if (!text.startsWith(DISPATCH_PREFIX)) return null;
  if (text.length > 16000) throw new Error('Chief dispatch envelope too large');
  let decoded: unknown;
  try { decoded = JSON.parse(text.slice(DISPATCH_PREFIX.length)); }
  catch { throw new Error('Chief dispatch JSON invalid'); }
  const record = exactRecord(decoded, ['dispatchId', 'targetIdentity', 'instruction']);
  if (typeof record.dispatchId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(record.dispatchId)
      || (record.targetIdentity !== 'hive-developer' && record.targetIdentity !== 'cb-developer')
      || typeof record.instruction !== 'string' || !record.instruction.trim() || record.instruction.length > 12000) {
    throw new Error('Invalid Chief dispatch fields');
  }
  return record as unknown as ChiefDirective;
}

/** Explicit Developer acknowledgement/results are not inferred from arbitrary assistant text. */
export function parseDeveloperResult(text: string, expectedDispatchId: string): DeveloperResult | null {
  if (!text.startsWith(RESULT_PREFIX)) return null;
  if (text.length > 10000) throw new Error('Developer result envelope too large');
  let decoded: unknown;
  try { decoded = JSON.parse(text.slice(RESULT_PREFIX.length)); }
  catch { throw new Error('Developer result JSON invalid'); }
  const record = exactRecord(decoded, ['dispatchId', 'status', 'summary', 'evidence']);
  if (record.dispatchId !== expectedDispatchId ||
    !['acknowledged', 'completed', 'blocked'].includes(String(record.status)) ||
    typeof record.summary !== 'string' || !record.summary.trim() || record.summary.length > 6000 ||
    !Array.isArray(record.evidence) || record.evidence.length > 20 ||
    !record.evidence.every(item => typeof item === 'string' && !!item.trim() && item.length <= 512)) {
    throw new Error('Developer result identity or contents invalid');
  }
  return record as unknown as DeveloperResult;
}

/** A Chief may dispatch only from its exact canonical conversation + a current
 * exclusive group-owned browser-tab Lease recorded by the Kernel. There is NO
 * Chief AgentSlot in the fixed 1-group/2-Developer organization.
 */
export function buildVerifiedChiefDispatch(
  directive: ChiefDirective,
  observedTabId: number,
  observed: ChatSnapshot,
  snapshot: NativeControlSnapshot,
  now: number,
): AgentMessage {
  const charter = snapshot.roleCharter;
  const group = snapshot.projectGroups?.find(item => item.id === charter?.groupId);
  if (!charter || !group || group.leadRole !== 'chief_engineer' ||
      !charter.roles.some(role => role.role === 'chief_engineer' &&
        role.identity === group.leadIdentity && role.conversationKey === group.leadConversationKey) ||
      observed.conversationKey !== group.leadConversationKey || observed.status !== 'idle' ||
      !observed.latestAssistantMessageId) {
    throw new Error('PENDING_CHIEF_RUNTIME: no verified effective Chief conversation');
  }
  const activeLease = snapshot.leases.filter(lease =>
    lease.holderId === group.leadIdentity && lease.status === 'active'
    && lease.mode === 'exclusive' && lease.resourceId === `browser-tab:gam-default:${observedTabId}`
    && (lease.expiresAt === undefined || lease.expiresAt > now));
  if (activeLease.length !== 1 || !group.members.some(member => member.projectId === activeLease[0]!.projectId)) {
    throw new Error('PENDING_CHIEF_RUNTIME: no unique current group-owned Chief Lease');
  }
  const role = charter.roles.find(item => item.identity === directive.targetIdentity && item.role === 'developer');
  if (!role?.projectId || !role.slotId ||
    !group.members.some(member => member.projectId === role.projectId && member.developerSlotId === role.slotId)) {
    throw new Error('Chief dispatch recipient is not a fixed Developer');
  }
  const project = snapshot.projects.find(item => item.id === role.projectId);
  const agent = snapshot.agents.find(item => item.id === role.slotId);
  if (!project || !agent || agent.projectId !== role.projectId ||
    agent.role !== 'developer' || agent.conversationKey !== role.conversationKey ||
    agent.desiredState !== 'active') {
    throw new Error('Chief dispatch target binding is stale');
  }
  const content = [
    'HIVE06_CHIEF_WORK_ORDER_V1',
    `Dispatch ID: ${directive.dispatchId}`,
    `Target: ${role.identity}`,
    `Chief conversation: ${group.leadConversationKey}`,
    `Contract digest: ${charter.digest}`,
    'Instructions:', directive.instruction,
    'Reply with exactly HIVE06_DEVELOPER_RESULT_V1 followed by one JSON object',
    'with fields dispatchId, status (acknowledged/completed/blocked), summary and evidence.',
    'Never claim Codex/Git/Result completion without verified evidence.',
  ].join('\n');
  if (content.length > 20000) throw new Error('Chief work order content too large');
  return {
    id: `chief-dispatch:${directive.dispatchId}`,
    project: project.name, fromRole: 'chief_engineer', target: { kind: 'role', role: 'developer' },
    type: 'announcement', content, taskId: directive.dispatchId,
    attemptIds: [], recipientConversationKeys: [role.conversationKey],
    createdAt: now, updatedAt: now,
  };
}

/** A result can go back only to the same Kernel-leased Chief Conversation.
 * A group-level Chief needs no fictitious Developer AgentSlot.
 */
export function findVerifiedChiefTab(
  snapshot: NativeControlSnapshot,
  tabs: readonly ManagedTab[],
  now: number,
): ManagedTab | undefined {
  const group = snapshot.projectGroups?.find(item => item.id === snapshot.roleCharter?.groupId);
  if (!group || !snapshot.roleCharter?.roles.some(role =>
    role.role === 'chief_engineer' && role.identity === group.leadIdentity &&
    role.conversationKey === group.leadConversationKey)) return undefined;
  const candidates = tabs.filter(tab => {
    if (tab.snapshot.status !== 'idle' || tab.snapshot.conversationKey !== group.leadConversationKey) return false;
    const leases = snapshot.leases.filter(lease =>
      lease.holderId === group.leadIdentity && lease.status === 'active'
      && lease.mode === 'exclusive' && lease.resourceId === `browser-tab:gam-default:${tab.tabId}`
      && group.members.some(member => member.projectId === lease.projectId)
      && (lease.expiresAt === undefined || lease.expiresAt > now));
    return leases.length === 1;
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function buildChiefResultMessage(
  original: AgentMessage,
  result: DeveloperResult,
  snapshot: NativeControlSnapshot,
  now: number,
): AgentMessage {
  if (!original.id.startsWith('chief-dispatch:') || original.taskId !== result.dispatchId ||
      original.fromRole !== 'chief_engineer' || original.recipientConversationKeys?.length !== 1) {
    throw new Error('Developer result is not tied to a Chief dispatch');
  }
  const charter = snapshot.roleCharter;
  const group = snapshot.projectGroups?.find(item => item.id === charter?.groupId);
  if (!charter || !group || !charter.roles.some(role =>
    role.role === 'chief_engineer' && role.identity === group.leadIdentity &&
    role.conversationKey === group.leadConversationKey)) {
    throw new Error('Chief result recipient authority unavailable');
  }
  const content = [
    'HIVE06_DEVELOPER_RESULT_V1',
    `Dispatch ID: ${result.dispatchId}`,
    `Developer-reported status (not independently verified): ${result.status}`,
    'Summary:', result.summary,
    'Developer-reported evidence (requires Git/CB verification):', ...result.evidence,
  ].join('\n');
  return {
    id: `chief-result:${result.dispatchId}:${result.status === 'acknowledged' ? 'ack' : 'final'}`,
    project: group.id, fromRole: 'developer', target: { kind: 'role', role: 'chief_engineer' },
    type: 'result', content, taskId: result.dispatchId,
    attemptIds: [], recipientConversationKeys: [group.leadConversationKey],
    createdAt: now, updatedAt: now,
  };
}

/** Exact identity/content comparison is the durable idempotency rule: never
 * allow a second prompt, conflicting receipt, or silent mutation for one ID.
 */
export function assertSameFrozenMessage(existing: AgentMessage, proposed: AgentMessage): void {
  if (existing.id !== proposed.id || existing.content !== proposed.content ||
      existing.taskId !== proposed.taskId || existing.project !== proposed.project ||
      existing.fromRole !== proposed.fromRole ||
      JSON.stringify(existing.target) !== JSON.stringify(proposed.target) ||
      JSON.stringify(existing.recipientConversationKeys) !== JSON.stringify(proposed.recipientConversationKeys)) {
    throw new Error('Chief dispatch or result identity conflict');
  }
}

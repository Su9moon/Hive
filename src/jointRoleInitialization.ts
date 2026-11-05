import type { ManagedTab } from './contracts';
import type { NativeControlSnapshot } from './nativeControlLegacy';
import type { CharterRecipient } from './roleCharterDelivery';

/**
 * Derive Role Charter recipients only from an authenticated Kernel snapshot and
 * an independently observed, managed ChatGPT tab. No source APPROVED string,
 * role label, tab ID, or optimistic browserRuntime profile readiness grants a send.
 */
export interface JointCharterTarget {
  recipient: CharterRecipient;
  runtime: { controlled: boolean; conversationKey: string; leaseValid: boolean };
  reason: 'READY' | 'PENDING_CHIEF_RUNTIME' | 'PENDING_DEVELOPER_RUNTIME';
}

export function planJointRoleCharterTargets(
  snapshot: NativeControlSnapshot,
  tabs: readonly ManagedTab[],
  now: number,
): JointCharterTarget[] {
  const charter = snapshot.roleCharter;
  if (!charter) return []; // No privileged Kernel import; never infer approval from the compiled fixture.
  const group = snapshot.projectGroups?.find(item => item.id === charter.groupId);
  if (!group || group.members.length !== 2 || charter.roles.length !== 3) throw new Error('Joint role charter group mismatch');

  const chief = charter.roles.find(role => role.role === 'chief_engineer');
  const developers = charter.roles.filter(role => role.role === 'developer');
  if (!chief || developers.length !== 2 || chief.identity !== group.leadIdentity
    || chief.conversationKey !== group.leadConversationKey || chief.projectId !== null || chief.slotId !== null) {
    throw new Error('Chief role charter identity mismatch');
  }
  for (const role of developers) {
    if (!role.slotId || !role.projectId ||
      !group.members.some(member => member.developerSlotId === role.slotId && member.projectId === role.projectId)) {
      throw new Error('Developer role charter identity mismatch');
    }
  }

  return charter.roles.map(role => {
    const project = role.projectId ? snapshot.projects.find(item => item.id === role.projectId) : undefined;
    const agent = role.slotId ? snapshot.agents.find(item => item.id === role.slotId) : undefined;
    const candidateTabs = agent ? tabs.filter(tab =>
      tab.tabId === agent.browserTabId &&
      tab.snapshot.conversationKey === role.conversationKey &&
      tab.binding.agentSlotId === agent.id &&
      tab.binding.role === role.role &&
      tab.binding.project === project?.name &&
      tab.snapshot.status === 'idle') : [];
    const lease = agent ? snapshot.leases.find(item => item.id === agent.browserLeaseId) : undefined;
    const leaseValid = !!(agent && project && lease && candidateTabs.length === 1
      && agent.role === 'developer' && agent.projectId === role.projectId
      && agent.conversationKey === role.conversationKey
      && agent.status === 'assigned' && agent.desiredState === 'active'
      && agent.browserState === 'open' && !agent.browserQuarantined
      && agent.browserPageStatus === 'idle' && agent.browserProfileId === 'gam-default'
      && agent.browserTabId !== undefined && agent.browserLeaseEpoch !== undefined
      && agent.browserRuntimeObservedAt !== undefined
      && now >= agent.browserRuntimeObservedAt && now - agent.browserRuntimeObservedAt <= 180000
      && lease.projectId === agent.projectId && lease.holderId === agent.id
      && lease.mode === 'exclusive' && lease.status === 'active'
      && lease.epoch === agent.browserLeaseEpoch
      && lease.resourceId === `browser-tab:gam-default:${agent.browserTabId}`
      && (lease.expiresAt === undefined || lease.expiresAt > now));
    const controlled = leaseValid && role.role === 'developer';
    const recipient: CharterRecipient = {
      identity: role.identity,
      role: role.role as CharterRecipient['role'],
      project: project?.name ?? charter.groupId,
      conversationKey: role.conversationKey,
      version: charter.version,
      digest: charter.digest,
      content: [
        'HIVE06_ROLE_CHARTER_INITIALIZATION',
        `Effective version: ${charter.version}`,
        `Contract SHA256: ${charter.digest}`,
        `Role identity: ${role.identity}`,
        `Formal conversation: ${role.conversationKey}`,
        'The following Kernel-approved charter is authoritative; stay within its project scope:',
        charter.content,
      ].join('\n'),
    };
    return {
      recipient,
      runtime: { controlled, conversationKey: role.conversationKey, leaseValid },
      reason: (controlled ? 'READY' : role.role === 'chief_engineer'
        ? 'PENDING_CHIEF_RUNTIME' : 'PENDING_DEVELOPER_RUNTIME') as JointCharterTarget['reason'],
    };
  });
}

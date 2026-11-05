import { expect, it } from 'vitest';
import { planJointRoleCharterTargets } from '../src/jointRoleInitialization';
import { planRoleCharterInitialization } from '../src/roleCharterDelivery';
import type { ManagedTab } from '../src/contracts';
import type { NativeControlSnapshot } from '../src/nativeControlLegacy';

const now = 1_900_000_000_000;
const chiefConversation = 'conversation:chief';
const developerConversation = 'conversation:dev';
const groupId = 'cb-hive-joint-development';
const projectId = 'project-hive';
const slotId = 'slot-hive';
const digest = 'a'.repeat(64);

function fixture(): { snapshot: NativeControlSnapshot; tabs: ManagedTab[] } {
  const snapshot = {
    roleCharter: {
      version: 'hive06-role-charter-v1', digest, groupId, content: '{"source":"pinned and approved"}',
      roles: [
        { identity: 'joint-chief', role: 'chief_engineer', projectId: null, slotId: null, conversationKey: chiefConversation },
        { identity: 'hive-developer', role: 'developer', projectId, slotId, conversationKey: developerConversation },
        { identity: 'cb-developer', role: 'developer', projectId: 'project-cb', slotId: 'slot-cb', conversationKey: 'conversation:cb' },
      ],
    },
    projectGroups: [{
      id: groupId, name: 'Joint', leadIdentity: 'joint-chief', leadRole: 'chief_engineer',
      leadConversationKey: chiefConversation, browserRuntime: 'NOT_VERIFIED',
      members: [{ projectId, developerSlotId: slotId }, { projectId: 'project-cb', developerSlotId: 'slot-cb' }],
    }],
    projects: [{ id: projectId, name: 'Hive' }, { id: 'project-cb', name: 'CB' }],
    agents: [{
      id: slotId, projectId, role: 'developer', status: 'assigned', desiredState: 'active',
      browserState: 'open', browserQuarantined: false, browserPageStatus: 'idle',
      browserProfileId: 'gam-default', browserTabId: 111, browserLeaseId: 'lease-111',
      browserLeaseEpoch: 4, browserRuntimeObservedAt: now - 100,
      conversationKey: developerConversation,
    }],
    leases: [{
      id: 'lease-111', projectId, holderId: slotId, mode: 'exclusive',
      resourceId: 'browser-tab:gam-default:111', epoch: 4, status: 'active',
    }],
  } as unknown as NativeControlSnapshot;
  const tabs = [{
    tabId: 111, windowId: 1, active: false,
    snapshot: { conversationKey: developerConversation, status: 'idle' },
    binding: { agentSlotId: slotId, project: 'Hive', role: 'developer', notes: '' },
  }] as unknown as ManagedTab[];
  return { snapshot, tabs };
}

it('holds the Chief without an actual managed Chief tab/lease, while routing a verified Developer', () => {
  const { snapshot, tabs } = fixture();
  const targets = planJointRoleCharterTargets(snapshot, tabs, now);
  expect(targets).toHaveLength(3);
  expect(targets[0]?.reason).toBe('PENDING_CHIEF_RUNTIME');
  expect(targets[1]?.reason).toBe('READY');
  expect(targets[2]?.reason).toBe('PENDING_DEVELOPER_RUNTIME');
  const plan = planRoleCharterInitialization(targets[1]!.recipient, [], [], targets[1]!.runtime, now);
  expect(plan.message?.recipientConversationKeys).toEqual([developerConversation]);
  expect(plan.message?.fromRole).toBe('role-charter');
  expect(planRoleCharterInitialization(targets[1]!.recipient, [plan.message!], [], targets[1]!.runtime, now + 1).message).toBeUndefined();
});

it('refuses stale observations, wrong tab/conversation, invalid lease epoch and expired lease', () => {
  const f = fixture();
  f.snapshot.agents[0]!.browserRuntimeObservedAt = now - 180001;
  expect(planJointRoleCharterTargets(f.snapshot, f.tabs, now)[1]?.reason).toBe('PENDING_DEVELOPER_RUNTIME');
  f.snapshot.agents[0]!.browserRuntimeObservedAt = now;
  f.tabs[0]!.binding.agentSlotId = 'wrong';
  expect(planJointRoleCharterTargets(f.snapshot, f.tabs, now)[1]?.reason).toBe('PENDING_DEVELOPER_RUNTIME');
  f.tabs[0]!.binding.agentSlotId = slotId;
  f.snapshot.leases[0]!.epoch = 5;
  expect(planJointRoleCharterTargets(f.snapshot, f.tabs, now)[1]?.reason).toBe('PENDING_DEVELOPER_RUNTIME');
  f.snapshot.leases[0]!.epoch = 4;
  f.snapshot.leases[0]!.expiresAt = now - 1;
  expect(planJointRoleCharterTargets(f.snapshot, f.tabs, now)[1]?.reason).toBe('PENDING_DEVELOPER_RUNTIME');
});

it('never enables initialization on an unimported fixture or changed organization', () => {
  const { snapshot, tabs } = fixture();
  delete snapshot.roleCharter;
  expect(planJointRoleCharterTargets(snapshot, tabs, now)).toEqual([]);
  const changed = fixture();
  changed.snapshot.projectGroups![0]!.leadConversationKey = 'conversation:impostor';
  expect(() => planJointRoleCharterTargets(changed.snapshot, changed.tabs, now)).toThrow(/Chief/);
});

it('preserves the deterministic message identity after restart and blocks unknown send outcomes', () => {
  const { snapshot, tabs } = fixture();
  const target = planJointRoleCharterTargets(snapshot, tabs, now)[1]!;
  const first = planRoleCharterInitialization(target.recipient, [], [], target.runtime, now);
  const attempt = {
    attemptId: 'a', batchId: 'b', tabId: 111, conversationKey: developerConversation,
    contentEpoch: 'epoch', messageId: first.message!.id, state: 'uncertain' as const,
    textLength: 5, baselineAssistantMessageCount: 0, createdAt: now, updatedAt: now,
  };
  expect(planRoleCharterInitialization(target.recipient, [first.message!], [attempt], target.runtime, now + 2).state).toBe('uncertain');
  expect(planRoleCharterInitialization(target.recipient, [], [attempt], target.runtime, now + 2).message).toBeUndefined();
});

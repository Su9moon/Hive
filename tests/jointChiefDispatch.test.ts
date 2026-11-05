import { expect, it } from 'vitest';
import {
  assertSameFrozenMessage, buildChiefResultMessage, buildVerifiedChiefDispatch,
  findVerifiedChiefTab, parseChiefDirective, parseDeveloperResult,
} from '../src/jointChiefDispatch';
import type { NativeControlSnapshot } from '../src/nativeControlLegacy';
import type { ChatSnapshot, ManagedTab } from '../src/contracts';

const now = 1_900_000_000_000;
const chief = 'conversation:chief';
const developer = 'conversation:developer';
const groupId = 'cb-hive-joint-development';

function fixture(): { control: NativeControlSnapshot; chat: ChatSnapshot; tabs: ManagedTab[] } {
  const control = {
    roleCharter: { groupId, version: 'v1', digest: 'f'.repeat(64), content: '{}', roles: [
      { identity: 'joint-chief', role: 'chief_engineer', conversationKey: chief, projectId: null, slotId: null },
      { identity: 'hive-developer', role: 'developer', conversationKey: developer, projectId: 'hive', slotId: 'hive-slot' },
      { identity: 'cb-developer', role: 'developer', conversationKey: 'conversation:cb', projectId: 'cb', slotId: 'cb-slot' },
    ] },
    projectGroups: [{ id: groupId, name: 'Joint', leadRole: 'chief_engineer', leadIdentity: 'joint-chief', leadConversationKey: chief,
      browserRuntime: 'NOT_VERIFIED', members: [{ projectId: 'hive', developerSlotId: 'hive-slot' }, { projectId: 'cb', developerSlotId: 'cb-slot' }] }],
    projects: [{ id: 'hive', name: 'Hive' }, { id: 'cb', name: 'CB' }],
    agents: [{ id: 'hive-slot', projectId: 'hive', role: 'developer', conversationKey: developer, desiredState: 'active' }],
    leases: [{ id: 'chief-l', projectId: 'hive', holderId: 'joint-chief', mode: 'exclusive', status: 'active', epoch: 2,
      resourceId: 'browser-tab:gam-default:101' }],
  } as unknown as NativeControlSnapshot;
  const chat = { status: 'idle', conversationKey: chief, latestAssistantMessageId: 'assistant-1',
    latestAssistantText: '' } as unknown as ChatSnapshot;
  const tabs = [{ tabId: 101, snapshot: chat, binding: { project: '', role: '', notes: '' } }] as unknown as ManagedTab[];
  return { control, chat, tabs };
}

const requestText = 'HIVE06_CHIEF_DISPATCH_V1\n' + JSON.stringify({
  dispatchId: 'HIVE-0000123', targetIdentity: 'hive-developer', instruction: 'Repair the existing test only',
});
it('parses only a strict Chief directive, not ordinary text, extra fields, or wrong role', () => {
  expect(parseChiefDirective('Please do work')).toBeNull();
  expect(parseChiefDirective(requestText)?.dispatchId).toBe('HIVE-0000123');
  expect(() => parseChiefDirective('HIVE06_CHIEF_DISPATCH_V1\n' + JSON.stringify({
    dispatchId: 'HIVE-0000123', targetIdentity: 'third-developer', instruction: 'No',
  }))).toThrow(/Invalid Chief dispatch/);
  expect(() => parseChiefDirective(requestText.replace('"instruction":', '"unexpected":0,"instruction":'))).toThrow(/Unexpected/);
});

it('requires live exact group Chief lease, conversation and assistant observation', () => {
  const f = fixture();
  const directive = parseChiefDirective(requestText)!;
  const msg = buildVerifiedChiefDispatch(directive, 101, f.chat, f.control, now);
  expect(msg.recipientConversationKeys).toEqual([developer]);
  expect(msg.id).toBe('chief-dispatch:HIVE-0000123');
  expect(msg.project).toBe('Hive');
  expect(findVerifiedChiefTab(f.control, f.tabs, now)?.tabId).toBe(101);
  f.control.leases[0]!.status = 'released';
  expect(() => buildVerifiedChiefDispatch(directive, 101, f.chat, f.control, now)).toThrow(/PENDING_CHIEF_RUNTIME/);
  expect(findVerifiedChiefTab(f.control, f.tabs, now)).toBeUndefined();
  f.control.leases[0]!.status = 'active';
  f.chat.conversationKey = 'conversation:ordinary';
  expect(() => buildVerifiedChiefDispatch(directive, 101, f.chat, f.control, now)).toThrow(/PENDING_CHIEF_RUNTIME/);
});

it('freezes dispatch identity; conflicting replays cannot modify an original task', () => {
  const f = fixture();
  const directive = parseChiefDirective(requestText)!;
  const original = buildVerifiedChiefDispatch(directive, 101, f.chat, f.control, now);
  assertSameFrozenMessage(original, buildVerifiedChiefDispatch(directive, 101, f.chat, f.control, now + 10));
  const conflict = buildVerifiedChiefDispatch({ ...directive, instruction: 'Different scope' }, 101, f.chat, f.control, now + 10);
  expect(() => assertSameFrozenMessage(original, conflict)).toThrow(/conflict/);
});

it('correlates explicit Developer ACK and final result to the exact original Chief Conversation', () => {
  const f = fixture();
  const msg = buildVerifiedChiefDispatch(parseChiefDirective(requestText)!, 101, f.chat, f.control, now);
  const ack = parseDeveloperResult('HIVE06_DEVELOPER_RESULT_V1\n' + JSON.stringify({
    dispatchId: 'HIVE-0000123', status: 'acknowledged', summary: 'Received', evidence: [],
  }), 'HIVE-0000123')!;
  expect(buildChiefResultMessage(msg, ack, f.control, now).id).toBe('chief-result:HIVE-0000123:ack');
  const result = { ...ack, status: 'completed' as const, summary: 'Tests pass', evidence: ['git:abc'] };
  const returned = buildChiefResultMessage(msg, result, f.control, now + 1);
  expect(returned.recipientConversationKeys).toEqual([chief]);
  expect(returned.id).toBe('chief-result:HIVE-0000123:final');
  expect(() => parseDeveloperResult('HIVE06_DEVELOPER_RESULT_V1\n' + JSON.stringify({
    ...result, dispatchId: 'OTHER-TASK',
  }), 'HIVE-0000123')).toThrow(/identity/);
});

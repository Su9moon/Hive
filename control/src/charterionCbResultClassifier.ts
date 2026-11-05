/**
 * CB is the sole TaskStore authority. This is a read-only projection of a
 * trusted-host-supplied CB get_result response, NOT evidence verification.
 * A transport-level done never implies business, tests, Git or package success.
 */
export interface CbResultDimensions {
  taskId: string;
  taskStatus: 'pending' | 'running' | 'done' | 'failed' | 'timeout' | 'unknown';
  businessStatus: 'success' | 'failed' | 'partial' | 'blocked' | 'unknown';
  testsStatus: 'passed' | 'failed' | 'not_run' | 'unknown';
  gitDeliveryStatus: 'published' | 'blocked' | 'partial' | 'not_run' | 'unknown';
  resultDeliveryStatus: 'ready' | 'pending' | 'failed' | 'blocked' | 'partial' | 'unavailable' | 'unknown';
  resultPackageSha256: string | null;
  verification: 'NOT_VERIFIED';
}

const enumValue = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && allowed.includes(v as T) ? v as T : fallback;

/** No network operations, retries, submission, keys or special case for Provider C. */
export function projectCbResultDimensions(value: unknown, expectedTaskId: string): CbResultDimensions {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    !/^T-[0-9]{6,}$/.test(expectedTaskId)) throw new Error('CB_RESULT_INVALID');
  const row = value as Record<string, unknown>;
  if (row.id !== expectedTaskId) throw new Error('CB_RESULT_TASK_ID_MISMATCH');
  const digest = row.result_package_sha256;
  return {
    taskId: expectedTaskId,
    taskStatus: enumValue(row.status, ['pending', 'running', 'done', 'failed', 'timeout'] as const, 'unknown'),
    businessStatus: enumValue(row.business_status, ['success', 'failed', 'partial', 'blocked'] as const, 'unknown'),
    testsStatus: enumValue(row.tests_status, ['passed', 'failed', 'not_run'] as const, 'unknown'),
    gitDeliveryStatus: enumValue(row.git_delivery_status, ['published', 'blocked', 'partial', 'not_run'] as const, 'unknown'),
    resultDeliveryStatus: enumValue(row.delivery_status, ['ready', 'pending', 'failed', 'blocked', 'partial', 'unavailable'] as const, 'unknown'),
    resultPackageSha256: typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest) ? digest : null,
    verification: 'NOT_VERIFIED',
  };
}

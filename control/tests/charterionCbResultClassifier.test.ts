import { expect, it } from 'vitest';
import { projectCbResultDimensions } from '../src/charterionCbResultClassifier';

it('never equates done with business success or package verification', () => {
  const result = projectCbResultDimensions({
    id: 'T-000499', status: 'done', business_status: 'failed', tests_status: 'not_run',
    git_delivery_status: 'published', delivery_status: 'ready',
    result_package_sha256: 'a'.repeat(64),
  }, 'T-000499');
  expect(result).toMatchObject({ taskStatus: 'done', businessStatus: 'failed',
    testsStatus: 'not_run', gitDeliveryStatus: 'published', resultDeliveryStatus: 'ready',
    verification: 'NOT_VERIFIED' });
});
it('distinguishes Codex execution failure from the unknown business result', () => {
  const result = projectCbResultDimensions({ id: 'T-000499', status: 'failed',
    business_status: 'unknown', tests_status: 'not_run' }, 'T-000499');
  expect(result.taskStatus).toBe('failed');
  expect(result.businessStatus).toBe('unknown');
  expect(result.resultPackageSha256).toBeNull();
});
it('rejects cross-task contamination and does not silently upgrade absent fields', () => {
  expect(() => projectCbResultDimensions({ id: 'T-000498', status: 'done' }, 'T-000499')).toThrow(/MISMATCH/);
  expect(projectCbResultDimensions({ id: 'T-000499' }, 'T-000499')).toMatchObject({
    taskStatus: 'unknown', businessStatus: 'unknown', testsStatus: 'unknown',
    gitDeliveryStatus: 'unknown', resultDeliveryStatus: 'unknown', verification: 'NOT_VERIFIED',
  });
});

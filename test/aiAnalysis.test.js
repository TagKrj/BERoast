import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateScore,
  classifyRepositorySize,
  gradeFromScore,
} from '../src/services/aiAnalysis.service.js';

const findings = (count, priority) =>
  Array.from({ length: count }, () => ({ priority }));

describe('calculateScore', () => {
  it('returns 100 when there are no findings', () => {
    assert.equal(calculateScore({}), 100);
  });

  it('weights priority by the domain multiplier', () => {
    // P0 weight 4 x security multiplier 7.
    assert.equal(calculateScore({ security: findings(1, 'p0') }), 72);
    // P0 weight 4 x maintainability multiplier 3.
    assert.equal(calculateScore({ maintainability: findings(1, 'p0') }), 88);
    // P3 weight 1 x interaction multiplier 3.
    assert.equal(calculateScore({ interaction: findings(1, 'p3') }), 97);
  });

  it('sums penalties across domains', () => {
    assert.equal(
      calculateScore({
        security: findings(1, 'p1'),
        robustness: findings(2, 'p2'),
      }),
      100 - 3 * 7 - 2 * 2 * 4,
    );
  });

  it('treats an unknown priority as weight 1', () => {
    assert.equal(calculateScore({ security: findings(1, 'urgent') }), 93);
  });

  it('floors at 0', () => {
    assert.equal(calculateScore({ security: findings(4, 'p0') }), 0);
  });

  // Documents the calibration problem: three findings already grade F.
  it('grades F after three P0 security findings', () => {
    assert.equal(
      gradeFromScore(calculateScore({ security: findings(3, 'p0') })),
      'F',
    );
  });
});

describe('gradeFromScore', () => {
  const cases = [
    [100, 'A'],
    [90, 'A'],
    [89, 'B+'],
    [80, 'B+'],
    [79, 'B'],
    [70, 'B'],
    [60, 'C+'],
    [50, 'C'],
    [40, 'D'],
    [39, 'F'],
    [0, 'F'],
  ];

  for (const [score, grade] of cases) {
    it(`maps ${score} to ${grade}`, () => {
      assert.equal(gradeFromScore(score), grade);
    });
  }
});

describe('classifyRepositorySize', () => {
  const stats = (overrides = {}) => ({
    fileCount: 10,
    totalBytes: 10_000,
    reviewableFileCount: 10,
    reviewableBytes: 10_000,
    treeTruncated: false,
    ...overrides,
  });

  it('classifies a small repository', async () => {
    const { sizeLabel } = await classifyRepositorySize(stats());
    assert.equal(sizeLabel, 'small');
  });

  it('is medium above 50 reviewable files', async () => {
    const { sizeLabel } = await classifyRepositorySize(
      stats({ reviewableFileCount: 51 }),
    );
    assert.equal(sizeLabel, 'medium');
  });

  it('is medium above 500 KB of reviewable code', async () => {
    const { sizeLabel } = await classifyRepositorySize(
      stats({ reviewableBytes: 500_001 }),
    );
    assert.equal(sizeLabel, 'medium');
  });

  it('is large above 250 reviewable files', async () => {
    const { sizeLabel } = await classifyRepositorySize(
      stats({ reviewableFileCount: 251 }),
    );
    assert.equal(sizeLabel, 'large');
  });

  it('is large when the GitHub tree is truncated', async () => {
    const { sizeLabel } = await classifyRepositorySize(
      stats({ treeTruncated: true }),
    );
    assert.equal(sizeLabel, 'large');
  });

  it('falls back to kept totals when reviewable stats are missing', async () => {
    const { sizeLabel } = await classifyRepositorySize({
      fileCount: 60,
      totalBytes: 10_000,
    });
    assert.equal(sizeLabel, 'medium');
  });
});

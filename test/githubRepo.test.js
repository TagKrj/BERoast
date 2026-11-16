import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analysisPriorityScore,
  isIgnoredRepositoryPath,
  isReviewableSourceFile,
  parseGithubRepoUrl,
} from '../src/services/githubRepo.service.js';

describe('parseGithubRepoUrl', () => {
  it('parses a repository URL', () => {
    assert.deepEqual(parseGithubRepoUrl('https://github.com/owner/repo'), {
      owner: 'owner',
      name: 'repo',
      fullName: 'owner/repo',
      htmlUrl: 'https://github.com/owner/repo',
    });
  });

  it('strips .git and ignores deeper paths', () => {
    assert.equal(
      parseGithubRepoUrl('https://github.com/owner/repo.git').fullName,
      'owner/repo',
    );
    assert.equal(
      parseGithubRepoUrl('https://www.github.com/owner/repo/tree/main/src')
        .fullName,
      'owner/repo',
    );
  });

  for (const url of [
    'https://gitlab.com/owner/repo',
    'https://github.com/owner',
    'not a url',
  ]) {
    it(`rejects ${url}`, () => {
      assert.throws(() => parseGithubRepoUrl(url), {
        statusCode: 400,
        code: 'INVALID_GITHUB_REPO_URL',
      });
    });
  }
});

describe('isIgnoredRepositoryPath', () => {
  const ignored = [
    'node_modules/react/index.js',
    'dist/app.js',
    'package-lock.json',
    '.vscode/settings.json',
    'public/app.min.js',
    '',
  ];
  const kept = [
    'src/app.js',
    '.env.example',
    'Dockerfile',
    '.github/workflows/ci.yml',
  ];

  for (const filePath of ignored) {
    it(`ignores "${filePath}"`, () => {
      assert.equal(isIgnoredRepositoryPath(filePath), true);
    });
  }

  for (const filePath of kept) {
    it(`keeps "${filePath}"`, () => {
      assert.equal(isIgnoredRepositoryPath(filePath), false);
    });
  }

  // Current behaviour, arguably wrong: a committed .env never reaches the security domain.
  it('ignores a committed .env file', () => {
    assert.equal(isIgnoredRepositoryPath('.env'), true);
  });
});

describe('isReviewableSourceFile', () => {
  it('accepts source blobs and rejects trees and assets', () => {
    assert.equal(isReviewableSourceFile({ type: 'blob', path: 'a.ts' }), true);
    assert.equal(isReviewableSourceFile({ type: 'tree', path: 'src' }), false);
    assert.equal(
      isReviewableSourceFile({ type: 'blob', path: 'logo.png' }),
      false,
    );
  });
});

describe('analysisPriorityScore', () => {
  const score = (path, size = 0) => analysisPriorityScore({ path, size });

  it('ranks auth services above constants', () => {
    assert.ok(score('src/services/auth.js') > score('src/constants/colors.js'));
  });

  it('ranks source above its tests', () => {
    assert.ok(score('src/utils/date.js') > score('src/utils/date.test.js'));
  });

  it('caps the file size bonus', () => {
    assert.equal(
      score('src/a.js', 10_000_000) - score('src/a.js', 0),
      160,
    );
  });
});

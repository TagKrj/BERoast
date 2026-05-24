import AppError from '../utils/appError.js';
import { createConcurrencyLimiter } from '../utils/concurrency.js';

const GITHUB_API_URL = 'https://api.github.com';

const CODE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.py',
  '.java',
  '.kt',
  '.go',
  '.rb',
  '.php',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.rs',
  '.swift',
  '.vue',
  '.svelte',
  '.html',
  '.css',
  '.scss',
  '.sql',
  '.yml',
  '.yaml',
  '.xml',
  '.md',
]);

const REVIEWABLE_FILE_NAMES = new Set([
  '.env.example',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
]);

const IGNORED_FOLDERS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.turbo',
  '.parcel-cache',
  'out',
  'target',
  'bin',
  'obj',
  'vendor',
  'Pods',
  '.gradle',
  '.mvn',
  '.idea',
  '.vscode',
  'tmp',
  'temp',
  'logs',
  'log',
  'storybook-static',
  '.output',
  '.angular',
  '__pycache__',
  '.venv',
  'venv',
  '.pytest_cache',
  '.mypy_cache',
  'DerivedData',
  '.build',
]);

const IGNORED_FILE_NAMES = new Set([
  '.DS_Store',
  'DS_Store',
  'npm-debug.log',
  'yarn-error.log',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Cargo.lock',
  'composer.lock',
  'poetry.lock',
]);

const IGNORED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.mp4',
  '.mov',
  '.mp3',
  '.wav',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.svg',
  '.ico',
  '.map',
  '.avi',
  '.glb',
  '.gltf',
  '.fbx',
  '.obj',
  '.blend',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.lock',
]);

const IGNORED_FILE_SUFFIXES = ['.min.js', '.min.css', 'bundle.js'];

const MAX_FILE_BYTES_FOR_ANALYSIS = Number.parseInt(
  process.env.ANALYSIS_MAX_FILE_BYTES ||
    process.env.MAX_FILE_BYTES_FOR_ANALYSIS ||
    '80000',
  10,
);
const MAX_PRIORITY_ANALYSIS_FILES = Number.parseInt(
  process.env.ANALYSIS_MAX_PRIORITY_FILES ||
    process.env.MAX_ANALYSIS_FILES ||
    '120',
  10,
);
const ANALYSIS_FETCH_CONCURRENT = Number.parseInt(
  process.env.ANALYSIS_FETCH_CONCURRENT ||
    process.env.ANALYSIS_MAX_CONCURRENT ||
    '5',
  10,
);

const NON_REVIEWABLE_FILE_PATTERN =
  /\.(lock|min\.js|min\.css|map|png|jpg|jpeg|gif|webp|svg|ico|pdf|zip|tar|gz|rar|7z|mp4|mov|avi|mp3|wav|glb|gltf|fbx|obj|blend|ttf|otf|woff|woff2)$/i;

const HIGH_PRIORITY_PREFIXES = [
  'src/pages/',
  'src/components/',
  'src/services/',
  'src/api/',
  'src/hooks/',
  'backend/',
  'controllers/',
  'services/',
  'routes/',
  'middleware/',
  'middlewares/',
  'auth/',
  'utils/',
  '.github/workflows/',
];

const HIGH_PRIORITY_SEGMENTS = new Set([
  'controllers',
  'services',
  'routes',
  'middleware',
  'middlewares',
  'auth',
  'api',
  'hooks',
  'pages',
  'components',
  'utils',
]);

const LOW_PRIORITY_SEGMENTS = new Set([
  'constants',
  'types',
  'styles',
  'style',
  'mock',
  'mocks',
  'fixtures',
  'config',
  'configs',
]);

const HIGH_PRIORITY_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.py',
  '.java',
  '.kt',
  '.go',
  '.rb',
  '.php',
  '.cs',
  '.rs',
  '.swift',
]);

export const parseGithubRepoUrl = (repoUrl) => {
  try {
    const url = new URL(repoUrl.trim());
    const isGithubHost = ['github.com', 'www.github.com'].includes(
      url.hostname.toLowerCase(),
    );

    if (!isGithubHost) {
      throw new Error('Not GitHub');
    }

    const [owner, rawName] = url.pathname.split('/').filter(Boolean);
    const name = rawName?.replace(/\.git$/i, '');

    if (!owner || !name) {
      throw new Error('Missing owner or repo');
    }

    return {
      owner,
      name,
      fullName: `${owner}/${name}`,
      htmlUrl: `https://github.com/${owner}/${name}`,
    };
  } catch {
    throw new AppError(
      'Invalid GitHub repository URL.',
      400,
      'INVALID_GITHUB_REPO_URL',
    );
  }
};

const githubHeaders = () => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(process.env.GITHUB_TOKEN && {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  }),
});

const githubFetchJson = async (url, errorMessage, errorCode) => {
  const response = await fetch(url, {
    headers: githubHeaders(),
  });
  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
  const rateLimitReset = response.headers.get('x-ratelimit-reset');

  if (response.status === 404) {
    throw new AppError(
      'Repository must be public.',
      404,
      'REPOSITORY_NOT_PUBLIC',
    );
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.message || errorMessage;

    if (
      response.status === 403 &&
      (rateLimitRemaining === '0' || /rate limit/i.test(message))
    ) {
      const resetAt = rateLimitReset
        ? new Date(Number(rateLimitReset) * 1000).toISOString()
        : null;

      throw new AppError(
        resetAt
          ? `GitHub API rate limit exceeded. Add GITHUB_TOKEN on the backend or try again after ${resetAt}.`
          : 'GitHub API rate limit exceeded. Add GITHUB_TOKEN on the backend or try again later.',
        429,
        'GITHUB_RATE_LIMIT_EXCEEDED',
      );
    }

    if (response.status === 403) {
      throw new AppError(
        'GitHub refused access to this repository. Make sure the repository is public and configure GITHUB_TOKEN on the backend if this happens on Render.',
        403,
        errorCode,
      );
    }

    throw new AppError(errorMessage, response.status, errorCode);
  }

  return response.json();
};

const getExtension = (filePath) => {
  const lastSlash = filePath.lastIndexOf('/');
  const fileName = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const dot = fileName.lastIndexOf('.');

  return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
};

const getFileName = (filePath) => {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
};

const isAllowedHiddenPath = (pathParts) =>
  pathParts[0] === '.github' && pathParts[1] === 'workflows';

const isExplicitReviewableFile = (filePath) =>
  REVIEWABLE_FILE_NAMES.has(getFileName(filePath));

const isIgnoredRepositoryPath = (filePath) => {
  if (!filePath) {
    return true;
  }

  if (isExplicitReviewableFile(filePath)) {
    return false;
  }

  const pathParts = filePath.split('/');
  const fileName = getFileName(filePath);
  const extension = getExtension(filePath);

  if (IGNORED_FILE_NAMES.has(fileName)) {
    return true;
  }

  if (
    pathParts.some((part, index) => {
      if (IGNORED_FOLDERS.has(part)) {
        return true;
      }

      return (
        part.startsWith('.') &&
        !isAllowedHiddenPath(pathParts) &&
        index < pathParts.length - 1
      );
    })
  ) {
    return true;
  }

  if (
    fileName.startsWith('.') &&
    !isAllowedHiddenPath(pathParts) &&
    !isExplicitReviewableFile(filePath)
  ) {
    return true;
  }

  if (IGNORED_EXTENSIONS.has(extension)) {
    return true;
  }

  return IGNORED_FILE_SUFFIXES.some((suffix) =>
    fileName.toLowerCase().endsWith(suffix.toLowerCase()),
  );
};

const isReviewableSourceFile = (file) => {
  if (file.type !== 'blob' || !file.path) {
    return false;
  }

  if (isIgnoredRepositoryPath(file.path)) {
    return false;
  }

  if (isExplicitReviewableFile(file.path)) {
    return true;
  }

  return CODE_EXTENSIONS.has(getExtension(file.path));
};

const isAnalysisCandidate = (file) =>
  isReviewableSourceFile(file) && file.size <= MAX_FILE_BYTES_FOR_ANALYSIS;

const pathSegments = (filePath) => filePath.split('/').filter(Boolean);

const hasHighPriorityPath = (filePath) => {
  const normalizedPath = filePath.replace(/\\/g, '/');

  if (
    HIGH_PRIORITY_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
  ) {
    return true;
  }

  return pathSegments(normalizedPath).some((segment) =>
    HIGH_PRIORITY_SEGMENTS.has(segment),
  );
};

const hasLowPriorityPath = (filePath) =>
  pathSegments(filePath).some((segment) => LOW_PRIORITY_SEGMENTS.has(segment));

const analysisPriorityScore = (file) => {
  const filePath = file.path || '';
  const fileName = getFileName(filePath);
  const extension = getExtension(filePath);
  let score = 0;

  if (hasHighPriorityPath(filePath) || isExplicitReviewableFile(filePath)) {
    score += 1_000;
  }

  if (HIGH_PRIORITY_EXTENSIONS.has(extension)) {
    score += 250;
  } else if (['.json', '.yml', '.yaml', '.sql'].includes(extension)) {
    score += 90;
  } else {
    score += 30;
  }

  if (hasLowPriorityPath(filePath)) {
    score -= 250;
  }

  if (
    /auth|login|token|jwt|session|password|secret|api|route|controller|service|middleware/i.test(
      filePath,
    )
  ) {
    score += 220;
  }

  if (/test|spec|stories/i.test(fileName)) {
    score -= 180;
  }

  score += Math.min(160, Math.floor((file.size || 0) / 750));

  return score;
};

const encodeRawPath = (filePath) =>
  filePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

const buildLanguageStats = (files) =>
  files.reduce((stats, file) => {
    const extension = getExtension(file.path) || 'unknown';
    stats[extension] = {
      fileCount: (stats[extension]?.fileCount || 0) + 1,
      totalBytes: (stats[extension]?.totalBytes || 0) + (file.size || 0),
    };
    return stats;
  }, {});

const buildReviewableStats = (files) => {
  const reviewableFiles = files.filter(isReviewableSourceFile);
  const assetFiles = files.filter((file) =>
    NON_REVIEWABLE_FILE_PATTERN.test(file.path || ''),
  );

  return {
    reviewableFileCount: reviewableFiles.length,
    reviewableBytes: reviewableFiles.reduce(
      (sum, file) => sum + (file.size || 0),
      0,
    ),
    assetFileCount: assetFiles.length,
    assetBytes: assetFiles.reduce((sum, file) => sum + (file.size || 0), 0),
  };
};

export const getRepositoryMetadata = async (repoUrl) => {
  const parsed = parseGithubRepoUrl(repoUrl);
  const repo = await githubFetchJson(
    `${GITHUB_API_URL}/repos/${parsed.owner}/${parsed.name}`,
    'Failed to fetch GitHub repository.',
    'GITHUB_REPOSITORY_FETCH_FAILED',
  );

  if (repo.private) {
    throw new AppError(
      'Repository must be public.',
      403,
      'REPOSITORY_NOT_PUBLIC',
    );
  }

  const branch = await githubFetchJson(
    `${GITHUB_API_URL}/repos/${parsed.owner}/${parsed.name}/branches/${repo.default_branch}`,
    'Failed to fetch repository default branch.',
    'GITHUB_BRANCH_FETCH_FAILED',
  );

  const tree = await githubFetchJson(
    `${GITHUB_API_URL}/repos/${parsed.owner}/${parsed.name}/git/trees/${branch.commit.sha}?recursive=1`,
    'Failed to fetch repository file tree.',
    'GITHUB_TREE_FETCH_FAILED',
  );

  const allFiles = tree.tree.filter((item) => item.type === 'blob');
  const files = allFiles.filter((file) => !isIgnoredRepositoryPath(file.path));
  const ignoredFiles = allFiles.filter((file) =>
    isIgnoredRepositoryPath(file.path),
  );
  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const reviewableStats = buildReviewableStats(files);

  return {
    repository: {
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      commitSha: branch.commit.sha,
      visibility: 'public',
    },
    stats: {
      fileCount: files.length,
      totalBytes,
      ignoredFileCount: ignoredFiles.length,
      ignoredBytes: ignoredFiles.reduce(
        (sum, file) => sum + (file.size || 0),
        0,
      ),
      ...reviewableStats,
      treeTruncated: Boolean(tree.truncated),
      languageStats: buildLanguageStats(files),
    },
    files,
  };
};

export const loadRepositoryCodeSample = async (metadata) => {
  const selectedFiles = metadata.files
    .filter(isAnalysisCandidate)
    .sort((left, right) => {
      const priorityDiff =
        analysisPriorityScore(right) - analysisPriorityScore(left);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return (right.size || 0) - (left.size || 0);
    })
    .slice(0, MAX_PRIORITY_ANALYSIS_FILES);

  const limit = createConcurrencyLimiter(ANALYSIS_FETCH_CONCURRENT);
  const snippets = (
    await Promise.all(
      selectedFiles.map((file) =>
        limit(async () => {
          const rawUrl = `https://raw.githubusercontent.com/${metadata.repository.owner}/${metadata.repository.name}/${metadata.repository.defaultBranch}/${encodeRawPath(file.path)}`;
          const response = await fetch(rawUrl, {
            headers: process.env.GITHUB_TOKEN
              ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
              : undefined,
          });

          if (!response.ok) {
            return null;
          }

          const content = await response.text();

          return {
            path: file.path,
            sha: file.sha,
            size: file.size || 0,
            priorityScore: analysisPriorityScore(file),
            content,
          };
        }),
      ),
    )
  ).filter(Boolean);

  const totalCharacters = snippets.reduce(
    (sum, file) => sum + file.content.length,
    0,
  );

  return {
    repositoryFullName: metadata.repository.fullName,
    commitSha: metadata.repository.commitSha,
    snippets,
    selectedFileCount: snippets.length,
    selectedCandidateCount: selectedFiles.length,
    totalCharacters,
  };
};

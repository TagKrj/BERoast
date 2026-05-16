import AppError from '../utils/appError.js';

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

const SKIP_PATH_PARTS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'vendor',
]);

const MAX_FILE_BYTES_FOR_ANALYSIS = 90_000;
const MAX_ANALYSIS_FILES = 35;
const MAX_ANALYSIS_CHARS = 120_000;

const NON_REVIEWABLE_FILE_PATTERN =
  /\.(lock|min\.js|min\.css|map|png|jpg|jpeg|gif|webp|svg|ico|pdf|zip|tar|gz|rar|7z|mp4|mov|avi|mp3|wav|glb|gltf|fbx|obj|blend|ttf|otf|woff|woff2)$/i;

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

  if (response.status === 404) {
    throw new AppError(
      'Repository must be public.',
      404,
      'REPOSITORY_NOT_PUBLIC',
    );
  }

  if (!response.ok) {
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

const isReviewableSourceFile = (file) => {
  if (file.type !== 'blob' || !file.path) {
    return false;
  }

  const pathParts = file.path.split('/');
  if (pathParts.some((part) => SKIP_PATH_PARTS.has(part))) {
    return false;
  }

  if (NON_REVIEWABLE_FILE_PATTERN.test(file.path)) {
    return false;
  }

  return CODE_EXTENSIONS.has(getExtension(file.path));
};

const isAnalysisCandidate = (file) =>
  isReviewableSourceFile(file) && file.size <= MAX_FILE_BYTES_FOR_ANALYSIS;

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

  const files = tree.tree.filter((item) => item.type === 'blob');
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
      const leftScore = left.size || 0;
      const rightScore = right.size || 0;
      return rightScore - leftScore;
    })
    .slice(0, MAX_ANALYSIS_FILES);

  const snippets = [];
  let usedChars = 0;

  for (const file of selectedFiles) {
    if (usedChars >= MAX_ANALYSIS_CHARS) {
      break;
    }

    const rawUrl = `https://raw.githubusercontent.com/${metadata.repository.owner}/${metadata.repository.name}/${metadata.repository.defaultBranch}/${encodeRawPath(file.path)}`;
    const response = await fetch(rawUrl, {
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : undefined,
    });

    if (!response.ok) {
      continue;
    }

    const content = await response.text();
    const remaining = MAX_ANALYSIS_CHARS - usedChars;
    const clippedContent = content.slice(0, Math.max(0, remaining));

    snippets.push({
      path: file.path,
      size: file.size || 0,
      content: clippedContent,
    });

    usedChars += clippedContent.length;
  }

  return {
    snippets,
    selectedFileCount: snippets.length,
    totalCharacters: usedChars,
  };
};

import User from '../models/user.model.js';
import AppError from '../utils/appError.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';
const DEFAULT_LOCAL_CALLBACK_URL =
  'http://localhost:5001/api/auth/github/callback';

export const isLocalhostUrl = (value) => {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return false;
  }
};

const hasConfiguredValue = (value) =>
  Boolean(value && !value.startsWith('replace_with_'));

const ensureGithubOAuthConfig = ({ clientId, clientSecret, mode }) => {
  if (!hasConfiguredValue(clientId) || !hasConfiguredValue(clientSecret)) {
    throw new AppError(
      `${mode} GitHub OAuth environment variables are not configured`,
      500,
      mode === 'local'
        ? 'GITHUB_LOCAL_OAUTH_NOT_CONFIGURED'
        : 'GITHUB_OAUTH_NOT_CONFIGURED',
    );
  }
};

const resolveProductionCallbackUrl = (requestOrigin) => {
  const configuredCallbackUrl = process.env.GITHUB_CALLBACK_URL;

  if (configuredCallbackUrl && !isLocalhostUrl(configuredCallbackUrl)) {
    return configuredCallbackUrl;
  }

  if (requestOrigin && !isLocalhostUrl(requestOrigin)) {
    return `${requestOrigin.replace(/\/$/, '')}/api/auth/github/callback`;
  }

  if (configuredCallbackUrl) {
    return configuredCallbackUrl;
  }

  return DEFAULT_LOCAL_CALLBACK_URL;
};

const resolveLocalCallbackUrl = () => {
  if (process.env.GITHUB_LOCAL_CALLBACK_URL) {
    return process.env.GITHUB_LOCAL_CALLBACK_URL;
  }

  if (
    process.env.GITHUB_CALLBACK_URL &&
    isLocalhostUrl(process.env.GITHUB_CALLBACK_URL)
  ) {
    return process.env.GITHUB_CALLBACK_URL;
  }

  return DEFAULT_LOCAL_CALLBACK_URL;
};

export const resolveGithubOAuthConfig = (requestOrigin) => {
  const isLocalRequest = isLocalhostUrl(requestOrigin);
  const oauthConfig = isLocalRequest
    ? {
        mode: 'local',
        clientId: process.env.GITHUB_LOCAL_CLIENT_ID,
        clientSecret: process.env.GITHUB_LOCAL_CLIENT_SECRET,
        callbackUrl: resolveLocalCallbackUrl(),
      }
    : {
        mode: 'production',
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackUrl: resolveProductionCallbackUrl(requestOrigin),
      };

  ensureGithubOAuthConfig(oauthConfig);

  return oauthConfig;
};

export const resolveGithubCallbackUrl = (requestOrigin) => {
  return resolveGithubOAuthConfig(requestOrigin).callbackUrl;
};

export const buildGithubAuthUrl = ({
  callbackUrl,
  oauthConfig,
  requestOrigin,
  state,
} = {}) => {
  const resolvedOAuthConfig =
    oauthConfig || resolveGithubOAuthConfig(requestOrigin || callbackUrl);

  const params = new URLSearchParams({
    client_id: resolvedOAuthConfig.clientId,
    redirect_uri: callbackUrl || resolvedOAuthConfig.callbackUrl,
    scope: 'read:user user:email',
    allow_signup: 'true',
  });

  if (state) {
    params.set('state', state);
  }

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
};

const requestGithubAccessToken = async ({ callbackUrl, code, oauthConfig }) => {
  const resolvedOAuthConfig =
    oauthConfig || resolveGithubOAuthConfig(callbackUrl);

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: resolvedOAuthConfig.clientId,
      client_secret: resolvedOAuthConfig.clientSecret,
      code,
      redirect_uri: callbackUrl || resolvedOAuthConfig.callbackUrl,
    }),
  });

  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new AppError(
      payload.error_description || 'GitHub token exchange failed',
      401,
      'GITHUB_TOKEN_EXCHANGE_FAILED',
    );
  }

  return payload.access_token;
};

const fetchGithubJson = async (url, accessToken) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new AppError(
      'Failed to fetch GitHub profile',
      401,
      'GITHUB_PROFILE_FETCH_FAILED',
    );
  }

  return response.json();
};

const pickPrimaryEmail = (githubProfile, emails) => {
  const primaryVerified = emails.find(
    (email) => email.primary && email.verified,
  );
  const firstVerified = emails.find((email) => email.verified);

  return (
    primaryVerified?.email ||
    firstVerified?.email ||
    githubProfile.email ||
    null
  );
};

const toAuthUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  github: {
    id: user.github.id,
    username: user.github.username,
    displayName: user.github.displayName,
    email: user.github.email,
    avatarUrl: user.github.avatarUrl,
    profileUrl: user.github.profileUrl,
  },
});

export const authenticateWithGithubCode = async ({
  callbackUrl,
  code,
  oauthConfig,
}) => {
  const resolvedOAuthConfig =
    oauthConfig || resolveGithubOAuthConfig(callbackUrl);

  if (!code) {
    throw new AppError(
      'GitHub authorization code is required',
      400,
      'GITHUB_CODE_REQUIRED',
    );
  }

  const accessToken = await requestGithubAccessToken({
    callbackUrl,
    code,
    oauthConfig: resolvedOAuthConfig,
  });
  const [githubProfile, emails] = await Promise.all([
    fetchGithubJson(GITHUB_USER_URL, accessToken),
    fetchGithubJson(GITHUB_EMAILS_URL, accessToken),
  ]);

  const email = pickPrimaryEmail(githubProfile, emails);
  const username = githubProfile.login;
  const displayName = githubProfile.name || username;
  const avatarUrl = githubProfile.avatar_url;
  const profileUrl = githubProfile.html_url;

  const user = await User.findOneAndUpdate(
    { 'github.id': String(githubProfile.id) },
    {
      $set: {
        github: {
          id: String(githubProfile.id),
          username,
          displayName,
          email,
          avatarUrl,
          profileUrl,
        },
        name: displayName,
        email,
        avatarUrl,
        authProvider: 'github',
        lastLoginAt: new Date(),
      },
      $setOnInsert: {
        role: 'user',
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  return toAuthUser(user);
};

export const formatCurrentUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  githubUsername: user.github.username,
});

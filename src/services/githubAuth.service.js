import User from '../models/user.model.js';
import AppError from '../utils/appError.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

const ensureGithubOAuthConfig = () => {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL } =
    process.env;

  if (
    !GITHUB_CLIENT_ID ||
    !GITHUB_CLIENT_SECRET ||
    !GITHUB_CALLBACK_URL ||
    GITHUB_CLIENT_ID.startsWith('replace_with_') ||
    GITHUB_CLIENT_SECRET.startsWith('replace_with_')
  ) {
    throw new AppError(
      'GitHub OAuth environment variables are not configured',
      500,
      'GITHUB_OAUTH_NOT_CONFIGURED',
    );
  }
};

export const buildGithubAuthUrl = (state) => {
  ensureGithubOAuthConfig();

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: 'read:user user:email',
    allow_signup: 'true',
  });

  if (state) {
    params.set('state', state);
  }

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
};

const requestGithubAccessToken = async (code) => {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_CALLBACK_URL,
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

export const authenticateWithGithubCode = async (code) => {
  ensureGithubOAuthConfig();

  if (!code) {
    throw new AppError(
      'GitHub authorization code is required',
      400,
      'GITHUB_CODE_REQUIRED',
    );
  }

  const accessToken = await requestGithubAccessToken(code);
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

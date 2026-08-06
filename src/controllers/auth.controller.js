import {
  authenticateWithGithubCode,
  buildGithubAuthUrl,
  formatCurrentUser,
  isLocalhostUrl,
  resolveGithubOAuthConfig,
} from '../services/githubAuth.service.js';
import { signAccessToken } from '../services/token.service.js';
import asyncHandler from '../utils/asyncHandler.js';

const getFrontendAuthCallbackUrl = (requestOrigin) => {
  if (isLocalhostUrl(requestOrigin)) {
    return (
      process.env.FRONTEND_LOCAL_AUTH_CALLBACK_URL ||
      process.env.FRONTEND_AUTH_CALLBACK_URL ||
      `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/github/callback`
    );
  }

  return (
    process.env.FRONTEND_AUTH_CALLBACK_URL ||
    `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/github/callback`
  );
};

const buildFrontendRedirectUrl = ({ accessToken, requestOrigin, user }) => {
  const redirectUrl = new URL(getFrontendAuthCallbackUrl(requestOrigin));
  redirectUrl.searchParams.set('accessToken', accessToken);
  redirectUrl.searchParams.set('user', JSON.stringify(user));
  return redirectUrl.toString();
};

const getRequestOrigin = (req) => {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  return `${protocol}://${req.get('host')}`;
};

export const getGithubAuthUrl = asyncHandler(async (req, res) => {
  const requestOrigin = getRequestOrigin(req);
  const oauthConfig = resolveGithubOAuthConfig(requestOrigin);
  const authUrl = buildGithubAuthUrl({
    oauthConfig,
    state: req.query.state,
  });

  const wantsBrowserRedirect =
    req.query.redirect === 'true' && req.accepts('html');
  if (wantsBrowserRedirect) {
    return res.redirect(authUrl);
  }

  return res.json({
    success: true,
    data: {
      authUrl,
    },
  });
});

export const handleGithubCallback = asyncHandler(async (req, res) => {
  const requestOrigin = getRequestOrigin(req);
  const oauthConfig = resolveGithubOAuthConfig(requestOrigin);
  const user = await authenticateWithGithubCode({
    callbackUrl: oauthConfig.callbackUrl,
    code: req.query.code,
    oauthConfig,
  });
  const accessToken = signAccessToken(user);

  if (req.query.response !== 'json') {
    return res.redirect(
      buildFrontendRedirectUrl({
        accessToken,
        requestOrigin,
        user,
      }),
    );
  }

  return res.json({
    success: true,
    message: 'Authenticated successfully',
    data: {
      accessToken,
      user,
    },
  });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  return res.json({
    success: true,
    data: {
      user: formatCurrentUser(req.user),
    },
  });
});

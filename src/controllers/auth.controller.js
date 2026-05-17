import {
  authenticateWithGithubCode,
  buildGithubAuthUrl,
  formatCurrentUser,
} from '../services/githubAuth.service.js';
import { signAccessToken } from '../services/token.service.js';
import asyncHandler from '../utils/asyncHandler.js';

const getFrontendAuthCallbackUrl = () =>
  process.env.FRONTEND_AUTH_CALLBACK_URL ||
  `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/github/callback`;

const buildFrontendRedirectUrl = ({ accessToken, user }) => {
  const redirectUrl = new URL(getFrontendAuthCallbackUrl());
  redirectUrl.searchParams.set('accessToken', accessToken);
  redirectUrl.searchParams.set('user', JSON.stringify(user));
  return redirectUrl.toString();
};

export const getGithubAuthUrl = asyncHandler(async (req, res) => {
  const authUrl = buildGithubAuthUrl(req.query.state);

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
  const user = await authenticateWithGithubCode(req.query.code);
  const accessToken = signAccessToken(user);

  if (req.query.response !== 'json') {
    return res.redirect(
      buildFrontendRedirectUrl({
        accessToken,
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

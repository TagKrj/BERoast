import express from 'express';
import {
  getCurrentUser,
  getGithubAuthUrl,
  handleGithubCallback,
} from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/auth/github:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get the GitHub OAuth authorization URL
 *     description: |
 *       Use this endpoint to start GitHub login.
 *       - If `redirect=true`, the server redirects the browser to GitHub.
 *       - If `redirect` is omitted or false, the API returns the OAuth URL in JSON.
 *       - `state` is optional and can be used by the frontend to track the login session.
 *     parameters:
 *       - in: query
 *         name: state
 *         required: false
 *         description: Optional OAuth state value.
 *         schema:
 *           type: string
 *         example: onboarding-flow
 *       - in: query
 *         name: redirect
 *         required: false
 *         description: Set to `true` to redirect the browser directly to GitHub.
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         example: false
 *     responses:
 *       200:
 *         description: OAuth URL returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GithubAuthUrlResponse'
 *             examples:
 *               jsonResponse:
 *                 summary: Example JSON response
 *                 value:
 *                   success: true
 *                   data:
 *                     authUrl: https://github.com/login/oauth/authorize?client_id=...
 *       302:
 *         description: Browser redirected to GitHub OAuth consent page.
 *       500:
 *         description: GitHub OAuth configuration is missing or invalid.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/github', getGithubAuthUrl);

/**
 * @openapi
 * /api/auth/github/callback:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Handle the GitHub OAuth callback
 *     description: |
 *       GitHub sends the authorization code to this endpoint after the user approves login.
 *       Send the `code` query param from GitHub. The API exchanges the code for an access token,
 *       loads the GitHub profile, creates or updates the user, and returns a signed JWT.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         description: Authorization code returned by GitHub.
 *         schema:
 *           type: string
 *         example: abc123githubcode
 *     responses:
 *       200:
 *         description: Authentication succeeded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GithubCallbackResponse'
 *             examples:
 *               successResponse:
 *                 summary: Example successful login response
 *                 value:
 *                   success: true
 *                   message: Authenticated successfully
 *                   data:
 *                     accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       id: 66cfd1c6b1a5f4f1b3f7e111
 *                       name: GitHub User
 *                       email: user@example.com
 *                       avatarUrl: https://avatars.githubusercontent.com/u/123456789?v=4
 *                       github:
 *                         id: '123456789'
 *                         username: github-user
 *                         displayName: GitHub User
 *                         email: user@example.com
 *                         avatarUrl: https://avatars.githubusercontent.com/u/123456789?v=4
 *                         profileUrl: https://github.com/github-user
 *       400:
 *         description: Missing authorization code.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: GitHub rejected the code exchange or profile fetch failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/github/callback', handleGithubCallback);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get the current authenticated user
 *     description: |
 *       Use this endpoint to verify that the JWT is valid and to fetch the current user profile.
 *       In Swagger UI, click **Authorize** and paste your raw JWT access token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurrentUserResponse'
 *             examples:
 *               successResponse:
 *                 summary: Example current user response
 *                 value:
 *                   success: true
 *                   data:
 *                     user:
 *                       id: 66cfd1c6b1a5f4f1b3f7e111
 *                       name: GitHub User
 *                       email: user@example.com
 *                       avatarUrl: https://avatars.githubusercontent.com/u/123456789?v=4
 *                       githubUsername: github-user
 *       401:
 *         description: Missing or invalid bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', authMiddleware, getCurrentUser);

export default router;

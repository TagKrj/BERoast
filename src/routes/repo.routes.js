import express from 'express';
import { checkRepo } from '../controllers/repo.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/repos/check:
 *   post:
 *     tags:
 *       - Repos
 *     summary: Check a GitHub repository
 *     description: Validates a GitHub repository URL, fetches repository metadata, and creates a roast check record.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repoUrl
 *             properties:
 *               repoUrl:
 *                 type: string
 *                 format: uri
 *                 example: https://github.com/facebook/react
 *           examples:
 *             sampleRepo:
 *               summary: Example GitHub repository URL
 *               value:
 *                 repoUrl: https://github.com/facebook/react
 *     responses:
 *       200:
 *         description: Repository checked successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Repository checked successfully
 *               data:
 *                 roastId: 66cfd1c6b1a5f4f1b3f7e111
 *                 repository:
 *                   owner: facebook
 *                   name: react
 *                   fullName: facebook/react
 *                   htmlUrl: https://github.com/facebook/react
 *                   defaultBranch: main
 *                 check:
 *                   fileCount: 1934
 *                   totalBytes: 12345678
 *                   sizeLabel: large
 *                   sizeDisplay: Large
 *                   sizeReason: Repository is large enough to require a personal OpenAI API key.
 *                   gptKeyRequired: true
 *                   nextAction: provide_openai_api_key
 *                 advice: Use a personal OpenAI API key to improve analysis quality for large repositories.
 *       400:
 *         description: Invalid GitHub repository URL
 *       401:
 *         description: Missing or invalid bearer token
 *       500:
 *         description: Server error
 */
router.post('/check', authMiddleware, checkRepo);

export default router;

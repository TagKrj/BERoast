import express from 'express';
import {
  analyzeRepo,
  getRoastDetail,
  listRoastHistory,
} from '../controllers/roast.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/roasts/history:
 *   get:
 *     tags:
 *       - Roasts
 *     summary: List completed roast history
 *     description: Returns completed roast reports for the authenticated user. Use this endpoint for the statistics/history screen.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Optional case-insensitive search by repository full name.
 *     responses:
 *       200:
 *         description: Roast history returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 items:
 *                   - roastId: 6a058c5c22f813fa54d72f64
 *                     grade: C+
 *                     repositoryFullName: sindresorhus/is
 *                     repositoryUrl: https://github.com/sindresorhus/is
 *                     roastDate: 2026-05-14T08:49:17.234Z
 *                     roastDateDisplay: 14/5/2026
 *                     sizeLabel: medium
 *                     sizeDisplay: Medium
 *                     totalCodeSmell: 7
 *                     totalSecurity: 1
 *                     analysisType: system_gemini
 *                 pagination:
 *                   page: 1
 *                   limit: 10
 *                   total: 1
 *                   totalPages: 1
 *       401:
 *         description: Missing or invalid bearer token
 */
router.get('/history', authMiddleware, listRoastHistory);

/**
 * @openapi
 * /api/roasts/{roastId}/analyze:
 *   post:
 *     tags:
 *       - Roasts
 *     summary: Analyze a checked repository
 *     description: Runs AI analysis for a checked roast report. Large repositories require openAiApiKey. Small and medium repositories use system Gemini by default, but use the user's OpenAI key when openAiApiKey is provided.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roastId
 *         required: true
 *         description: Use the roastId returned by POST /api/repos/check.
 *         schema:
 *           type: string
 *         example: 6a05921f2c881a6185446fe1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               openAiApiKey:
 *                 type: string
 *                 example: sk-proj-xxxxxxxxxxxxxxxx
 *           examples:
 *             noKey:
 *               summary: Small or medium repository using system Gemini
 *               value: {}
 *             sampleKey:
 *               summary: User OpenAI key for any size, required for large repositories
 *               value:
 *                 openAiApiKey: sk-proj-xxxxxxxxxxxxxxxx
 *     responses:
 *       200:
 *         description: Repository analyzed successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Repository analyzed successfully
 *               data:
 *                 roast:
 *                   id: 66cfd1c6b1a5f4f1b3f7e111
 *                   roastDate: 2026-05-14T10:00:00.000Z
 *                   roastDateDisplay: 14 May 2026
 *                   repository:
 *                     owner: facebook
 *                     name: react
 *                     fullName: facebook/react
 *                     htmlUrl: https://github.com/facebook/react
 *                   grade: A
 *                   score: 92
 *                   summaryTitle: Strong architecture
 *                   summary: Clean modular code with a few areas to improve.
 *                   shortReview: Solid codebase with room for refinement.
 *                   repoInfo:
 *                     fileCount: 1934
 *                     sizeLabel: large
 *                     sizeDisplay: Large
 *                     totalCodeSmell: 12
 *                     totalSecurity: 3
 *                     analysisType: system_gemini
 *                     analysisTypeDisplay: Gemini default system analysis
 *                   issues:
 *                     codeSmells:
 *                       - index: 1
 *                         fileName: App.js
 *                         filePath: src/App.js
 *                         title: Example smell
 *                         description: Example description
 *                         startLine: 10
 *                         endLine: 14
 *                         severity: medium
 *                         severityDisplay: Medium
 *                     security: []
 *       400:
 *         description: Invalid payload or missing OpenAI key for large repositories
 *       401:
 *         description: Missing or invalid bearer token
 *       404:
 *         description: Roast report not found
 *       409:
 *         description: Roast is not ready for analysis
 *       500:
 *         description: Server error
 */
router.post('/:roastId/analyze', authMiddleware, analyzeRepo);

/**
 * @openapi
 * /api/roasts/{roastId}:
 *   get:
 *     tags:
 *       - Roasts
 *     summary: Get saved roast report detail
 *     description: Returns a completed saved report, including code smell and security issue lists.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roastId
 *         required: true
 *         schema:
 *           type: string
 *         example: 6a058c5c22f813fa54d72f64
 *     responses:
 *       200:
 *         description: Roast report detail returned successfully
 *       401:
 *         description: Missing or invalid bearer token
 *       404:
 *         description: Roast report not found
 */
router.get('/:roastId', authMiddleware, getRoastDetail);

export default router;

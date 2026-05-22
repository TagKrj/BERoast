import express from 'express';
import {
  analyzeRepo,
  deleteRoast,
  generatePromptForIssue,
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
 *                   repoInfo:
 *                     fileCount: 1934
 *                     sizeLabel: large
 *                     sizeDisplay: Large
 *                     totalCodeSmell: 12
 *                     totalSecurity: 3
 *                     totalHigh: 4
 *                     totalMedium: 8
 *                     totalLow: 3
 *                     analysisType: system_gemini
 *                     analysisTypeDisplay: Gemini default system analysis
 *                   issues:
 *                     codeSmells:
 *                       all: 12
 *                       totalHigh: 2
 *                       totalMedium: 7
 *                       totalLow: 3
 *                       items:
 *                         - index: 1
 *                           id: 66cfd1c6b1a5f4f1b3f7e222
 *                           type: code_smell
 *                           fileName: App.js
 *                           filePath: src/App.js
 *                           title: Example smell
 *                           description: Example description
 *                           suggestion: Split the large function into smaller focused functions and add a regression test for the affected behavior.
 *                           startLine: 10
 *                           endLine: 14
 *                           severity: medium
 *                           severityDisplay: Medium
 *                           fixPrompt: null
 *                           fixPromptVersion: 0
 *                           fixPromptGeneratedAt: null
 *                     security:
 *                       all: 3
 *                       totalHigh: 2
 *                       totalMedium: 1
 *                       totalLow: 0
 *                       items: []
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
 * /api/roasts/{roastId}/issues/{issueId}/prompt:
 *   post:
 *     tags:
 *       - Roasts
 *     summary: Generate or regenerate a fix prompt for one issue
 *     description: Generates a prompt the user can paste into a coding assistant to fix one code smell or security issue. First generation may use an empty body. Regeneration requires regenerateInstruction; system Gemini analyzes that instruction and creates a meaningfully different prompt from the previous version.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roastId
 *         required: true
 *         schema:
 *           type: string
 *         example: 66cfd1c6b1a5f4f1b3f7e111
 *       - in: path
 *         name: issueId
 *         required: true
 *         schema:
 *           type: string
 *         example: 66cfd1c6b1a5f4f1b3f7e222
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               regenerateInstruction:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Required when regenerating an existing prompt. Describe how the new prompt should be changed.
 *                 example: Make the prompt shorter and focus on a minimal code diff with tests.
 *               instruction:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional alias for regenerateInstruction.
 *               promptInstruction:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional alias for regenerateInstruction.
 *           examples:
 *             firstGenerate:
 *               summary: First prompt generation
 *               value: {}
 *             regenerateWithInstruction:
 *               summary: Regenerate with user instruction
 *               value:
 *                 regenerateInstruction: Make it more detailed, include unit tests, and ask for a diff.
 *     responses:
 *       200:
 *         description: Fix prompt generated successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Fix prompt generated successfully
 *               data:
 *                 issue:
 *                   id: 66cfd1c6b1a5f4f1b3f7e222
 *                   type: code_smell
 *                   index: 1
 *                   fileName: App.js
 *                   filePath: src/App.js
 *                   title: Example smell
 *                   description: Example description
 *                   suggestion: Split the component logic into smaller functions and keep rendering separate from data preparation.
 *                   startLine: 10
 *                   endLine: 14
 *                   severity: medium
 *                   severityDisplay: Medium
 *                   fixPrompt: "You are a senior software engineer. Help me fix this code smell issue..."
 *                   fixPromptVersion: 1
 *                   fixPromptInstruction: Make it more detailed, include unit tests, and ask for a diff.
 *                   fixPromptInstructionAnalysis: System Gemini interpreted the request as making the regenerated prompt more detailed, requiring unit tests, and asking for a clear diff.
 *                   fixPromptGeneratedAt: 2026-05-22T10:00:00.000Z
 *       400:
 *         description: Invalid payload or missing regenerateInstruction when regenerating
 *       401:
 *         description: Missing or invalid bearer token
 *       404:
 *         description: Roast report or issue not found
 *       502:
 *         description: AI regeneration provider failed
 */
router.post(
  '/:roastId/issues/:issueId/prompt',
  authMiddleware,
  generatePromptForIssue,
);

/**
 * @openapi
 * /api/roasts/{roastId}:
 *   delete:
 *     tags:
 *       - Roasts
 *     summary: Delete a saved roast report
 *     description: Deletes one completed roast report from the authenticated user's history, including its code smell and security issue rows. Use roastId from GET /api/roasts/history.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roastId
 *         required: true
 *         description: The roastId of the history item to delete.
 *         schema:
 *           type: string
 *         example: 6a058c5c22f813fa54d72f64
 *     responses:
 *       200:
 *         description: Roast report deleted successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Roast report deleted successfully
 *               data:
 *                 roast:
 *                   roastId: 6a058c5c22f813fa54d72f64
 *                   repositoryFullName: TagKrj/UTTQ_Web
 *                   repositoryUrl: https://github.com/TagKrj/UTTQ_Web
 *                   roastDate: 2026-05-14T08:49:17.234Z
 *                   roastDateDisplay: 14/5/2026
 *       401:
 *         description: Missing or invalid bearer token
 *       404:
 *         description: Roast report not found
 */
router.delete('/:roastId', authMiddleware, deleteRoast);

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

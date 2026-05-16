import { z } from 'zod';
import { checkRepository } from '../services/roast.service.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';

const checkRepositorySchema = z.object({
  repoUrl: z.string().url(),
});

export const checkRepo = asyncHandler(async (req, res) => {
  const parsed = checkRepositorySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(
      'Invalid GitHub repository URL.',
      400,
      'INVALID_GITHUB_REPO_URL',
    );
  }

  const data = await checkRepository({
    repoUrl: parsed.data.repoUrl,
    userId: req.user._id,
  });

  return res.json({
    success: true,
    message: 'Repository checked successfully',
    data,
  });
});

import { z } from 'zod';
import mongoose from 'mongoose';
import {
  analyzeCheckedRepository,
  getRoastHistory,
  getRoastReportDetail,
} from '../services/roast.service.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';

const analyzeRepositorySchema = z.object({
  openAiApiKey: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().optional()),
});

export const analyzeRepo = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.roastId)) {
    throw new AppError('Roast report not found.', 404, 'ROAST_NOT_FOUND');
  }

  const parsed = analyzeRepositorySchema.safeParse(req.body || {});

  if (!parsed.success) {
    throw new AppError(
      'Invalid analysis payload.',
      400,
      'INVALID_ANALYSIS_PAYLOAD',
    );
  }

  const roast = await analyzeCheckedRepository({
    roastId: req.params.roastId,
    userId: req.user._id,
    openAiApiKey: parsed.data.openAiApiKey,
  });

  return res.json({
    success: true,
    message: 'Repository analyzed successfully',
    data: {
      roast,
    },
  });
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().trim().optional(),
});

export const listRoastHistory = asyncHandler(async (req, res) => {
  const parsed = historyQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new AppError('Invalid history query.', 400, 'INVALID_HISTORY_QUERY');
  }

  const data = await getRoastHistory({
    userId: req.user._id,
    ...parsed.data,
  });

  return res.json({
    success: true,
    data,
  });
});

export const getRoastDetail = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.roastId)) {
    throw new AppError('Roast report not found.', 404, 'ROAST_NOT_FOUND');
  }

  const roast = await getRoastReportDetail({
    roastId: req.params.roastId,
    userId: req.user._id,
  });

  return res.json({
    success: true,
    data: {
      roast,
    },
  });
});

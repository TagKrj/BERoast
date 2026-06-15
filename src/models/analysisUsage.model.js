import mongoose from 'mongoose';

const analysisUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roastRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoastRun',
      required: true,
      index: true,
    },
    dayKey: {
      type: String,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      default: 'Asia/Ho_Chi_Minh',
    },
    usedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    resetAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: 'analysis_usages',
    timestamps: true,
    versionKey: false,
  },
);

analysisUsageSchema.index({ userId: 1, dayKey: 1, usedAt: -1 });
analysisUsageSchema.index({ dayKey: 1, usedAt: -1 });

const AnalysisUsage = mongoose.model('AnalysisUsage', analysisUsageSchema);

export default AnalysisUsage;

import mongoose from 'mongoose';

const analysisFileCacheSchema = new mongoose.Schema(
  {
    repositoryFullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    fileSha: {
      type: String,
      required: true,
      trim: true,
    },
    analysisType: {
      type: String,
      enum: [
        'maintainability',
        'architecture',
        'security',
        'robustness',
        'operational',
        'interaction',
      ],
      required: true,
    },
    provider: {
      type: String,
      enum: ['system_gemini', 'user_openai'],
      required: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    rulesHash: {
      type: String,
      required: true,
      trim: true,
    },
    rawDetections: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    detectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'analysis_file_caches',
    timestamps: true,
    versionKey: false,
  },
);

analysisFileCacheSchema.index(
  {
    repositoryFullName: 1,
    filePath: 1,
    fileSha: 1,
    analysisType: 1,
    provider: 1,
    model: 1,
    rulesHash: 1,
  },
  { unique: true },
);
analysisFileCacheSchema.index({ repositoryFullName: 1, detectedAt: -1 });

const AnalysisFileCache = mongoose.model(
  'AnalysisFileCache',
  analysisFileCacheSchema,
);

export default AnalysisFileCache;

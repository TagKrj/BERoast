import mongoose from 'mongoose';

const roastRunSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    repositoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
      index: true,
    },
    input: {
      repoUrl: {
        type: String,
        required: true,
        trim: true,
      },
    },
    repoSnapshot: {
      owner: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      fullName: {
        type: String,
        required: true,
      },
      htmlUrl: {
        type: String,
        required: true,
      },
      defaultBranch: {
        type: String,
        default: null,
      },
      commitSha: {
        type: String,
        default: null,
      },
    },
    status: {
      type: String,
      enum: ['checked', 'analyzing', 'completed', 'failed'],
      required: true,
      default: 'checked',
      index: true,
    },
    check: {
      fileCount: Number,
      totalBytes: Number,
      sizeLabel: {
        type: String,
        enum: ['small', 'medium', 'large'],
      },
      sizeReason: String,
      gptKeyRequired: Boolean,
      checkedAt: Date,
    },
    ai: {
      analysisProvider: {
        type: String,
        enum: ['system_gemini', 'user_openai'],
      },
      model: String,
      usedPersonalApiKey: Boolean,
    },
    result: {
      roastDate: Date,
      roastDateDisplay: String,
      grade: {
        type: String,
        enum: ['A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
      },
      score: {
        type: Number,
        min: 0,
        max: 100,
      },
      summaryTitle: String,
      summary: String,
      shortReview: [String],
      metrics: {
        fileCount: Number,
        sizeLabel: {
          type: String,
          enum: ['small', 'medium', 'large'],
        },
        codeSmellCount: Number,
        securityCount: Number,
      },
      completedAt: Date,
    },
    error: {
      code: String,
      message: String,
    },
  },
  {
    collection: 'roast_runs',
    timestamps: true,
    versionKey: false,
  },
);

roastRunSchema.index({ userId: 1, createdAt: -1 });
roastRunSchema.index({ _id: 1, userId: 1 });
roastRunSchema.index({ repositoryId: 1, createdAt: -1 });
roastRunSchema.index({ status: 1, updatedAt: -1 });

const RoastRun = mongoose.model('RoastRun', roastRunSchema);

export default RoastRun;

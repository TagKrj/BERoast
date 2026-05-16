import mongoose from 'mongoose';

const repositorySchema = new mongoose.Schema(
  {
    owner: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    htmlUrl: {
      type: String,
      required: true,
      trim: true,
    },
    defaultBranch: {
      type: String,
      default: null,
    },
    visibility: {
      type: String,
      enum: ['public'],
      default: 'public',
      required: true,
    },
    lastKnown: {
      fileCount: Number,
      totalBytes: Number,
      sizeLabel: {
        type: String,
        enum: ['small', 'medium', 'large'],
      },
      sizeReason: String,
      assessedBy: {
        type: String,
        enum: ['gemini'],
      },
      assessedAt: Date,
    },
  },
  {
    collection: 'repositories',
    timestamps: true,
    versionKey: false,
  },
);

repositorySchema.index({ owner: 1, name: 1 }, { unique: true });
repositorySchema.index({ fullName: 1 });

const Repository = mongoose.model('Repository', repositorySchema);

export default Repository;

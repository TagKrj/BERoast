import mongoose from 'mongoose';

const roastIssueSchema = new mongoose.Schema(
  {
    roastRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoastRun',
      required: true,
      index: true,
    },
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
    type: {
      type: String,
      enum: ['code_smell', 'security'],
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    startLine: {
      type: Number,
      required: true,
      min: 1,
    },
    endLine: {
      type: Number,
      required: true,
      min: 1,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    ruleId: {
      type: String,
      default: null,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
  },
  {
    collection: 'roast_issues',
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

roastIssueSchema.index({ roastRunId: 1, type: 1, index: 1 });
roastIssueSchema.index({ roastRunId: 1, severity: 1 });
roastIssueSchema.index({ userId: 1, createdAt: -1 });

const RoastIssue = mongoose.model('RoastIssue', roastIssueSchema);

export default RoastIssue;

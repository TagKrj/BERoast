import mongoose from 'mongoose';

const githubSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    avatarUrl: {
      type: String,
      required: true,
      trim: true,
    },
    profileUrl: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    github: {
      type: githubSchema,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    avatarUrl: {
      type: String,
      required: true,
      trim: true,
    },
    authProvider: {
      type: String,
      enum: ['github'],
      default: 'github',
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ 'github.id': 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ 'github.username': 1 });

const User = mongoose.model('User', userSchema);

export default User;

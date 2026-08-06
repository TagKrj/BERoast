# RoastVN MongoDB Design

## Scope

This design supports the Figma flow and the product requirements:

- GitHub OAuth login.
- Repository pre-check from a public GitHub URL.
- AI repository size classification: `small`, `medium`, `large`.
- Large repositories require the user's personal OpenAI API key for analysis.
- Small and medium repositories can use the system Gemini key.
- Roast report storage for history and detail views.
- Source code is read for analysis and then deleted. Source files are not stored in MongoDB.

## Main Access Patterns

1. Login with GitHub and upsert the user profile.
2. Check a public GitHub repo and show file count plus size classification.
3. Start an analysis run for a checked repo.
4. Return the completed report with code smell and security issue lists.
5. Show the user's analysis history as a compact list.
6. Open a past report from history.

## Collection Overview

### `users`

Stores the application user created from GitHub OAuth.

```js
{
  _id: ObjectId,
  github: {
    id: String,
    username: String,
    displayName: String,
    email: String,
    avatarUrl: String,
    profileUrl: String
  },
  name: String,
  email: String,
  avatarUrl: String,
  authProvider: "github",
  role: "user",
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- Unique: `{ "github.id": 1 }`
- Sparse unique: `{ email: 1 }`
- Lookup: `{ "github.username": 1 }`

Notes:

- Do not store GitHub access tokens unless the app later needs private repo access.
- If tokens are ever stored, encrypt them outside this document model.

### `repositories`

Stores canonical public repo metadata so repeated roasts can reference the same repo.

```js
{
  _id: ObjectId,
  owner: String,
  name: String,
  fullName: String,
  htmlUrl: String,
  defaultBranch: String,
  visibility: "public",
  lastKnown: {
    fileCount: Number,
    totalBytes: Number,
    sizeLabel: "small" | "medium" | "large",
    sizeReason: String,
    assessedBy: "gemini",
    assessedAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- Unique: `{ owner: 1, name: 1 }`
- Search/list: `{ fullName: 1 }`

### `roast_runs`

Stores one check or analysis run. This document is optimized for history list and report header reads.

```js
{
  _id: ObjectId,
  userId: ObjectId,
  repositoryId: ObjectId,
  input: {
    repoUrl: String
  },
  repoSnapshot: {
    owner: String,
    name: String,
    fullName: String,
    htmlUrl: String,
    defaultBranch: String,
    commitSha: String
  },
  status: "checked" | "analyzing" | "completed" | "failed",
  check: {
    fileCount: Number,
    totalBytes: Number,
    sizeLabel: "small" | "medium" | "large",
    sizeReason: String,
    gptKeyRequired: Boolean,
    checkedAt: Date
  },
  ai: {
    analysisProvider: "system_gemini" | "user_openai",
    model: String,
    usedPersonalApiKey: Boolean
  },
  result: {
    roastDate: Date,
    roastDateDisplay: String,
    grade: "A" | "B+" | "B" | "C+" | "C" | "D" | "F",
    score: Number,
    metrics: {
      fileCount: Number,
      sizeLabel: "small" | "medium" | "large",
      totalIssues: Number,
      totalMaintainability: Number,
      totalArchitecture: Number,
      totalSecurity: Number,
      totalRobustness: Number,
      totalOperational: Number,
      totalInteraction: Number
    },
    completedAt: Date
  },
  error: {
    code: String,
    message: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- History list: `{ userId: 1, createdAt: -1 }`
- Detail authorization: `{ _id: 1, userId: 1 }`
- Repo analytics: `{ repositoryId: 1, createdAt: -1 }`
- Status cleanup/monitoring: `{ status: 1, updatedAt: -1 }`

Notes:

- `roast_runs` intentionally stores report header data and counters, not all issues.
- `roastDateDisplay` is kept for the exact UI format, for example `24/3/2025`.
- `roastDate` remains a real `Date` for sorting and filtering.

### `roast_issues`

Stores individual domain findings. This avoids unbounded issue arrays inside `roast_runs`.

```js
{
  _id: ObjectId,
  roastRunId: ObjectId,
  userId: ObjectId,
  repositoryId: ObjectId,
  type: "maintainability" | "architecture" | "security" | "robustness" | "operational" | "interaction",
  index: Number,
  filePath: String,
  title: String,
  description: String,
  suggestion: String,
  startLine: Number,
  endLine: Number,
  priority: "p0" | "p1" | "p2" | "p3",
  ruleId: String,
  confidence: Number,
  fixPrompt: String,
  fixPromptVersion: Number,
  fixPromptInstruction: String,
  fixPromptInstructionAnalysis: String,
  fixPromptGeneratedAt: Date,
  createdAt: Date
}
```

Indexes:

- Report issue list: `{ roastRunId: 1, type: 1, index: 1 }`
- Filtering by priority: `{ roastRunId: 1, priority: 1 }`
- User-level audit: `{ userId: 1, createdAt: -1 }`

Notes:

- `type` maps directly to the six UI sections: maintainability, architecture, security, robustness, operational, and interaction.
- Store `startLine` and `endLine` as numbers so the frontend can display `line X-Y`.
- `priority` maps to the production urgency scale shown in the report: P0 Production blocker, P1 Must address before scaling, P2 Should address during continued development, and P3 Acceptable MVP debt.
- `suggestion` is shown in the issue detail card as "Suggestions on how to fix it".
- `fixPrompt`, `fixPromptVersion`, `fixPromptInstruction`, `fixPromptInstructionAnalysis`, and `fixPromptGeneratedAt` support the Generate prompt / Regenerate prompt action per issue.
- Regeneration requires `fixPromptInstruction`; the backend sends that instruction to system Gemini so the new prompt is generated from the user's requested change instead of rotating automatically.

### `analysis_file_caches`

Stores raw per-file AI detection results so unchanged files do not need to be sent to Gemini/OpenAI again. Source code is not stored in this collection.

```js
{
  _id: ObjectId,
  repositoryFullName: String,
  filePath: String,
  fileSha: String,
  analysisType: "maintainability" | "architecture" | "security" | "robustness" | "operational" | "interaction",
  provider: "system_gemini" | "user_openai",
  model: String,
  rulesHash: String,
  rawDetections: Array,
  detectedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- Unique cache lookup: `{ repositoryFullName: 1, filePath: 1, fileSha: 1, analysisType: 1, provider: 1, model: 1, rulesHash: 1 }`
- Repo cache audit: `{ repositoryFullName: 1, detectedAt: -1 }`

Notes:

- `fileSha` is the GitHub blob SHA from the repository tree.
- `rulesHash` invalidates cache when the relevant detection rules change.
- Cache stores raw detections only; validation still runs with the current validation prompt/rules.

### `analysis_usages`

Stores one usage event whenever a user starts the expensive analysis step. The repository check step does not create a usage event, so users can check repository metadata without consuming the daily analysis quota.

```js
{
  _id: ObjectId,
  userId: ObjectId,
  roastRunId: ObjectId,
  dayKey: "2026-06-15",
  timezone: "Asia/Ho_Chi_Minh",
  usedAt: Date,
  resetAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- Daily user quota lookup: `{ userId: 1, dayKey: 1, usedAt: -1 }`
- Daily audit: `{ dayKey: 1, usedAt: -1 }`
- Roast usage lookup: `{ roastRunId: 1 }`

Notes:

- This collection is separate from `roast_runs` so deleting a report from history does not restore the user's daily quota.
- The backend blocks `POST /api/roasts/:roastId/analyze` after `DAILY_ANALYSIS_LIMIT` usage events in the current Vietnam day.
- The quota error returns `retryAfterDisplay` such as `5h30` and `resetAt` so the frontend can show when analysis becomes available again.

### `refresh_tokens`

Optional collection for refresh-token rotation if the backend uses persistent sessions.

```js
{
  _id: ObjectId,
  userId: ObjectId,
  tokenHash: String,
  userAgent: String,
  ip: String,
  expiresAt: Date,
  revokedAt: Date,
  createdAt: Date
}
```

Indexes:

- Unique: `{ tokenHash: 1 }`
- User sessions: `{ userId: 1, createdAt: -1 }`
- TTL: `{ expiresAt: 1 }`

### `user_ai_keys`

Optional future collection. For the first version, prefer not storing personal OpenAI keys. Use the key only for the current analysis request.

If a "remember my key" feature is added later:

```js
{
  _id: ObjectId,
  userId: ObjectId,
  provider: "openai",
  encryptedKey: String,
  keyLast4: String,
  label: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- `{ userId: 1, provider: 1, isActive: 1 }`

Security rules:

- Never store the raw API key.
- Encrypt `encryptedKey` with a server-side encryption key or KMS.
- Never return `encryptedKey` in API responses.

## Relationship Model

```text
users 1 --- N roast_runs
repositories 1 --- N roast_runs
roast_runs 1 --- N roast_issues
users 1 --- N analysis_usages
users 1 --- N refresh_tokens
users 1 --- N user_ai_keys (optional)
```

## Why Issues Are Referenced Instead Of Embedded

MongoDB works best when data accessed together is stored together, but issue lists can become large for big repositories. Keeping each issue in `roast_issues` prevents `roast_runs` from growing toward the 16MB document limit and keeps the history list fast.

The report detail endpoint should load:

1. The `roast_runs` document by `_id` and `userId`.
2. Related `roast_issues` by `roastRunId`, grouped by `type`.

## Suggested API To Collection Mapping

| Endpoint                            | Collections                                     |
| ----------------------------------- | ----------------------------------------------- |
| `GET /api/auth/github`              | none                                            |
| `GET /api/auth/github/callback`     | `users`, optional `refresh_tokens`              |
| `GET /api/me`                       | `users`                                         |
| `POST /api/repos/check`             | `repositories`, `roast_runs`                    |
| `POST /api/roasts/:roastId/analyze` | `analysis_usages`, `roast_runs`, `roast_issues` |
| `GET /api/roasts/history`           | `roast_runs`                                    |
| `GET /api/roasts/:roastId`          | `roast_runs`, `roast_issues`                    |

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
    summaryTitle: String,
    summary: String,
    shortReview: [String],
    metrics: {
      fileCount: Number,
      sizeLabel: "small" | "medium" | "large",
      codeSmellCount: Number,
      securityCount: Number
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

- `roast_runs` intentionally stores summary and counters, not all issues.
- `roastDateDisplay` is kept for the exact UI format, for example `24/3/2025`.
- `roastDate` remains a real `Date` for sorting and filtering.

### `roast_issues`

Stores individual code smell and security findings. This avoids unbounded issue arrays inside `roast_runs`.

```js
{
  _id: ObjectId,
  roastRunId: ObjectId,
  userId: ObjectId,
  repositoryId: ObjectId,
  type: "code_smell" | "security",
  index: Number,
  filePath: String,
  title: String,
  description: String,
  startLine: Number,
  endLine: Number,
  severity: "low" | "medium" | "high",
  ruleId: String,
  confidence: Number,
  createdAt: Date
}
```

Indexes:

- Report issue list: `{ roastRunId: 1, type: 1, index: 1 }`
- Filtering by severity: `{ roastRunId: 1, severity: 1 }`
- User-level audit: `{ userId: 1, createdAt: -1 }`

Notes:

- `type` maps directly to the two UI sections: code smells and security issues.
- Store `startLine` and `endLine` as numbers so the frontend can display `line X-Y`.

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
users 1 --- N refresh_tokens
users 1 --- N user_ai_keys (optional)
```

## Why Issues Are Referenced Instead Of Embedded

MongoDB works best when data accessed together is stored together, but issue lists can become large for big repositories. Keeping each issue in `roast_issues` prevents `roast_runs` from growing toward the 16MB document limit and keeps the history list fast.

The report detail endpoint should load:

1. The `roast_runs` document by `_id` and `userId`.
2. Related `roast_issues` by `roastRunId`, grouped by `type`.

## Suggested API To Collection Mapping

| Endpoint | Collections |
| --- | --- |
| `GET /api/auth/github` | none |
| `GET /api/auth/github/callback` | `users`, optional `refresh_tokens` |
| `GET /api/me` | `users` |
| `POST /api/repos/check` | `repositories`, `roast_runs` |
| `POST /api/roasts/:roastId/analyze` | `roast_runs`, `roast_issues` |
| `GET /api/roasts/history` | `roast_runs` |
| `GET /api/roasts/:roastId` | `roast_runs`, `roast_issues` |


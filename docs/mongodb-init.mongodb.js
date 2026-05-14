// Initial MongoDB setup for RoastVN.
// Run with mongosh after choosing the target database.
// This script does not include credentials or connection strings.

const database = db.getSiblingDB('beroast');

const ensureCollection = async (name, options) => {
  if ((await database.getCollectionNames()).includes(name)) {
    await database.runCommand({
      collMod: name,
      validator: options.validator,
      validationLevel: options.validationLevel,
      validationAction: options.validationAction,
    });
    return;
  }

  await database.createCollection(name, options);
};

await ensureCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'github',
        'name',
        'authProvider',
        'role',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        github: {
          bsonType: 'object',
          required: ['id', 'username', 'avatarUrl', 'profileUrl'],
          properties: {
            id: { bsonType: 'string' },
            username: { bsonType: 'string' },
            displayName: { bsonType: ['string', 'null'] },
            email: { bsonType: ['string', 'null'] },
            avatarUrl: { bsonType: 'string' },
            profileUrl: { bsonType: 'string' },
          },
        },
        name: { bsonType: 'string' },
        email: { bsonType: ['string', 'null'] },
        avatarUrl: { bsonType: 'string' },
        authProvider: { enum: ['github'] },
        role: { enum: ['user', 'admin'] },
        lastLoginAt: { bsonType: ['date', 'null'] },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
});

await ensureCollection('repositories', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'owner',
        'name',
        'fullName',
        'htmlUrl',
        'visibility',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        owner: { bsonType: 'string' },
        name: { bsonType: 'string' },
        fullName: { bsonType: 'string' },
        htmlUrl: { bsonType: 'string' },
        defaultBranch: { bsonType: ['string', 'null'] },
        visibility: { enum: ['public'] },
        lastKnown: {
          bsonType: ['object', 'null'],
          properties: {
            fileCount: { bsonType: 'int' },
            totalBytes: { bsonType: ['long', 'int', 'double'] },
            sizeLabel: { enum: ['small', 'medium', 'large'] },
            sizeReason: { bsonType: 'string' },
            assessedBy: { enum: ['gemini'] },
            assessedAt: { bsonType: 'date' },
          },
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
});

await ensureCollection('roast_runs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'userId',
        'repositoryId',
        'input',
        'repoSnapshot',
        'status',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        userId: { bsonType: 'objectId' },
        repositoryId: { bsonType: 'objectId' },
        input: {
          bsonType: 'object',
          required: ['repoUrl'],
          properties: {
            repoUrl: { bsonType: 'string' },
          },
        },
        repoSnapshot: {
          bsonType: 'object',
          required: ['owner', 'name', 'fullName', 'htmlUrl'],
          properties: {
            owner: { bsonType: 'string' },
            name: { bsonType: 'string' },
            fullName: { bsonType: 'string' },
            htmlUrl: { bsonType: 'string' },
            defaultBranch: { bsonType: ['string', 'null'] },
            commitSha: { bsonType: ['string', 'null'] },
          },
        },
        status: { enum: ['checked', 'analyzing', 'completed', 'failed'] },
        check: {
          bsonType: ['object', 'null'],
          properties: {
            fileCount: { bsonType: 'int' },
            totalBytes: { bsonType: ['long', 'int', 'double'] },
            sizeLabel: { enum: ['small', 'medium', 'large'] },
            sizeReason: { bsonType: 'string' },
            gptKeyRequired: { bsonType: 'bool' },
            checkedAt: { bsonType: 'date' },
          },
        },
        ai: {
          bsonType: ['object', 'null'],
          properties: {
            analysisProvider: { enum: ['system_gemini', 'user_openai'] },
            model: { bsonType: 'string' },
            usedPersonalApiKey: { bsonType: 'bool' },
          },
        },
        result: {
          bsonType: ['object', 'null'],
          properties: {
            roastDate: { bsonType: 'date' },
            roastDateDisplay: { bsonType: 'string' },
            grade: { enum: ['A', 'B+', 'B', 'C+', 'C', 'D', 'F'] },
            score: { bsonType: 'int', minimum: 0, maximum: 100 },
            summaryTitle: { bsonType: 'string' },
            summary: { bsonType: 'string' },
            shortReview: {
              bsonType: 'array',
              items: { bsonType: 'string' },
            },
            metrics: {
              bsonType: 'object',
              properties: {
                fileCount: { bsonType: 'int' },
                sizeLabel: { enum: ['small', 'medium', 'large'] },
                codeSmellCount: { bsonType: 'int' },
                securityCount: { bsonType: 'int' },
              },
            },
            completedAt: { bsonType: 'date' },
          },
        },
        error: {
          bsonType: ['object', 'null'],
          properties: {
            code: { bsonType: 'string' },
            message: { bsonType: 'string' },
          },
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
});

await ensureCollection('roast_issues', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'roastRunId',
        'userId',
        'repositoryId',
        'type',
        'index',
        'filePath',
        'title',
        'description',
        'startLine',
        'endLine',
        'severity',
        'createdAt',
      ],
      properties: {
        roastRunId: { bsonType: 'objectId' },
        userId: { bsonType: 'objectId' },
        repositoryId: { bsonType: 'objectId' },
        type: { enum: ['code_smell', 'security'] },
        index: { bsonType: 'int' },
        filePath: { bsonType: 'string' },
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        startLine: { bsonType: 'int', minimum: 1 },
        endLine: { bsonType: 'int', minimum: 1 },
        severity: { enum: ['low', 'medium', 'high'] },
        ruleId: { bsonType: ['string', 'null'] },
        confidence: {
          bsonType: ['double', 'int', 'null'],
          minimum: 0,
          maximum: 1,
        },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
});

await ensureCollection('refresh_tokens', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'tokenHash', 'expiresAt', 'createdAt'],
      properties: {
        userId: { bsonType: 'objectId' },
        tokenHash: { bsonType: 'string' },
        userAgent: { bsonType: ['string', 'null'] },
        ip: { bsonType: ['string', 'null'] },
        expiresAt: { bsonType: 'date' },
        revokedAt: { bsonType: ['date', 'null'] },
        createdAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
});

await ensureCollection('user_ai_keys', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'userId',
        'provider',
        'encryptedKey',
        'keyLast4',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        userId: { bsonType: 'objectId' },
        provider: { enum: ['openai'] },
        encryptedKey: { bsonType: 'string' },
        keyLast4: { bsonType: 'string' },
        label: { bsonType: ['string', 'null'] },
        isActive: { bsonType: 'bool' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
  validationLevel: 'strict',
  validationAction: 'error',
});

await database.users.createIndex({ 'github.id': 1 }, { unique: true });
await database.users.createIndex({ email: 1 }, { unique: true, sparse: true });
await database.users.createIndex({ 'github.username': 1 });

await database.repositories.createIndex(
  { owner: 1, name: 1 },
  { unique: true },
);
await database.repositories.createIndex({ fullName: 1 });

await database.roast_runs.createIndex({ userId: 1, createdAt: -1 });
await database.roast_runs.createIndex({ _id: 1, userId: 1 });
await database.roast_runs.createIndex({ repositoryId: 1, createdAt: -1 });
await database.roast_runs.createIndex({ status: 1, updatedAt: -1 });

await database.roast_issues.createIndex({ roastRunId: 1, type: 1, index: 1 });
await database.roast_issues.createIndex({ roastRunId: 1, severity: 1 });
await database.roast_issues.createIndex({ userId: 1, createdAt: -1 });

await database.refresh_tokens.createIndex({ tokenHash: 1 }, { unique: true });
await database.refresh_tokens.createIndex({ userId: 1, createdAt: -1 });
await database.refresh_tokens.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

await database.user_ai_keys.createIndex({
  userId: 1,
  provider: 1,
  isActive: 1,
});

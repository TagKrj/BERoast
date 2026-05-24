import AnalysisFileCache from '../../models/analysisFileCache.model.js';
import { resolveProviderModel } from './llmClient.service.js';
import { sha256 } from '../../utils/hash.js';

const fileCacheKey = ({
  analysisType,
  file,
  provider,
  repositoryFullName,
  rulesHash,
}) => ({
  repositoryFullName,
  filePath: file.path,
  fileSha: file.sha,
  analysisType,
  provider,
  model: resolveProviderModel(provider),
  rulesHash,
});

export const rulesContentHash = (...rules) => sha256(rules.join('\n---\n'));

export const getCachedFileDetections = async ({
  analysisType,
  files,
  provider,
  repositoryFullName,
  rulesHash,
}) => {
  const cacheableFiles = files.filter((file) => file.sha);

  if (cacheableFiles.length === 0) {
    return {
      cachedDetections: [],
      missingFiles: files,
    };
  }

  const keys = cacheableFiles.map((file) =>
    fileCacheKey({
      analysisType,
      file,
      provider,
      repositoryFullName,
      rulesHash,
    }),
  );
  const documents = await AnalysisFileCache.find({
    $or: keys,
  }).lean();
  const cacheByFilePath = new Map(
    documents.map((document) => [document.filePath, document.rawDetections]),
  );
  const missingFiles = files.filter((file) => !cacheByFilePath.has(file.path));
  const cachedDetections = files.flatMap(
    (file) => cacheByFilePath.get(file.path) || [],
  );

  return {
    cachedDetections,
    missingFiles,
  };
};

export const saveFileDetectionsToCache = async ({
  analysisType,
  detectionsByFile,
  files,
  provider,
  repositoryFullName,
  rulesHash,
}) => {
  const writes = files
    .filter((file) => file.sha)
    .map((file) => ({
      updateOne: {
        filter: fileCacheKey({
          analysisType,
          file,
          provider,
          repositoryFullName,
          rulesHash,
        }),
        update: {
          $set: {
            ...fileCacheKey({
              analysisType,
              file,
              provider,
              repositoryFullName,
              rulesHash,
            }),
            rawDetections: detectionsByFile.get(file.path) || [],
            detectedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

  if (writes.length === 0) {
    return;
  }

  await AnalysisFileCache.bulkWrite(writes, { ordered: false });
};

import fs from 'fs/promises';
import path from 'path';

const cache = new Map();

export const loadRuleFile = async (fileName) => {
  if (cache.has(fileName)) {
    return cache.get(fileName);
  }

  const filePath = path.join(process.cwd(), 'docs', fileName);
  const content = await fs.readFile(filePath, 'utf8');
  cache.set(fileName, content);
  return content;
};

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve from this module, not process.cwd(), so containers and test runners find the rules.
const DOCS_DIR = fileURLToPath(new URL('../../../docs/', import.meta.url));
const cache = new Map();

export const loadRuleFile = async (fileName) => {
  if (cache.has(fileName)) {
    return cache.get(fileName);
  }

  const filePath = path.join(DOCS_DIR, fileName);
  const content = await fs.readFile(filePath, 'utf8');
  cache.set(fileName, content);
  return content;
};

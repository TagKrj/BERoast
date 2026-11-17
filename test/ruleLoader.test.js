import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { analysisDomainValues } from '../src/services/analysis/analysisDomains.js';
import { loadRuleFile } from '../src/services/analysis/ruleLoader.service.js';

describe('analysis rule files', () => {
  for (const domain of analysisDomainValues()) {
    for (const fileName of [domain.rule1File, domain.rule2File]) {
      it(`${domain.key}: ${fileName} exists and is not empty`, async () => {
        const content = await loadRuleFile(fileName);
        assert.ok(content.trim().length > 0);
      });
    }
  }
});

# Robustness Detection Rules (Phase 1 - Detection)

## Purpose

Detect potential runtime resilience problems with high recall.

## Robustness Issue Definition

A robustness issue is code that may fail unpredictably, recover poorly, or provide weak behavior under invalid input, network failure, null values, or edge cases.

## Categories

### Missing Input Validation
- Request/body/query/form values are used without schema or boundary checks.
- Numeric, date, enum, URL, or ID inputs are trusted without normalization.

### Weak Error Handling
- Async operations lack try/catch or catch handlers.
- Errors are swallowed or replaced with vague responses.
- Failure paths leave state inconsistent.

### Null And Undefined Safety
- Deep property access without guards.
- Optional data is assumed to exist.

### Retry And Fallback Gaps
- External calls have no timeout, retry, or fallback where failure is expected.
- Provider failures can crash the entire workflow.

### Edge Case Handling
- Empty arrays, empty files, missing config, unsupported states, or partial responses are not handled.

## Heuristic Metrics

- input_validation_strength: strong / weak / none
- error_handling_coverage: strong / partial / none
- null_safety: strong / partial / weak
- async_failure_handling: strong / partial / none
- fallback_behavior: clear / partial / missing

## Output Requirements

Return a RAW detection JSON list with fileName, filePath, robustnessConcern, category, title, description, suggestion, evidence, startLine, endLine, priority, and metrics.

Priority must be P0, P1, P2, or P3.

If no issues are found, return:

[]

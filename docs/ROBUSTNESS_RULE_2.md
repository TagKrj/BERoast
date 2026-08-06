# Robustness Validation Rules (Phase 2 - Precision & Filtering)

## Purpose

Validate robustness findings and keep only issues with a concrete failure mode.

## Validation Criteria

- Keep issues only when evidence shows invalid input, async failure, null access, missing fallback, or edge-case risk.
- Remove generic requests for “better error handling” without a clear failure path.
- Remove duplicate issues in the same code region.
- Prefer production-facing paths over test-only or internal-only concerns.

## Output Requirements

Return FINAL JSON:

[
  {
    "index": 1,
    "fileName": "example.js",
    "filePath": "src/services/example.js",
    "title": "Async provider call lacks fallback handling",
    "description": "The provider request can fail or time out, but the surrounding code does not define a predictable fallback or user-facing failure path.",
    "suggestion": "Wrap the provider call with timeout-aware error handling and return a structured error or fallback response.",
    "startLine": 1,
    "endLine": 1,
    "priority": "P2",
    "priorityDisplay": "P2 – Should address during continued development"
  }
]

Priority definitions:
- P0: Production blocker. Must be fixed before deployment.
- P1: Must address before scaling. May not block the MVP, but must be addressed before significant growth.
- P2: Should address during continued development. Should be included in the near-term development backlog.
- P3: Acceptable MVP debt. Acceptable temporarily; monitor and revisit later.

If no valid issues remain, return:

[]

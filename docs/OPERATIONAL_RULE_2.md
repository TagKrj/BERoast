# Operational Validation Rules (Phase 2 - Precision & Filtering)

## Purpose

Validate operational findings and keep only issues that can affect deployment, production runtime, monitoring, cost, or scaling.

## Validation Criteria

- Evidence must point to config, deployment, runtime, logging, rate limit, health, CI/CD, or quota behavior.
- Remove generic process advice.
- Remove issues that cannot be observed from the provided file.
- Merge duplicates in the same operational area.

## Output Requirements

Return FINAL JSON:

[
  {
    "index": 1,
    "fileName": "app.js",
    "filePath": "src/app.js",
    "title": "Expensive analysis endpoint lacks per-user quota",
    "description": "The endpoint can trigger costly AI calls without a per-user usage boundary, creating quota and cost risk in production.",
    "suggestion": "Add an authenticated daily analysis quota and return a clear 429 response when the user exceeds it.",
    "startLine": 1,
    "endLine": 1,
    "priority": "P1",
    "priorityDisplay": "P1 – Must address before scaling"
  }
]

Priority definitions:
- P0: Production blocker. Must be fixed before deployment.
- P1: Must address before scaling. May not block the MVP, but must be addressed before significant growth.
- P2: Should address during continued development. Should be included in the near-term development backlog.
- P3: Acceptable MVP debt. Acceptable temporarily; monitor and revisit later.

If no valid issues remain, return:

[]

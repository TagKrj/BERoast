# Architecture Validation Rules (Phase 2 - Precision & Filtering)

## Purpose

Validate architecture detections and keep only issues with clear structural evidence.

## Validation Criteria

- The issue must show a concrete boundary, layering, coupling, cohesion, or dependency-direction problem.
- Evidence must refer to observable code structure, imports, responsibilities, or file organization.
- Remove purely stylistic complaints.
- Remove claims that require repository-wide knowledge not present in the evidence.
- Merge duplicate architecture issues that refer to the same module and same structural weakness.

## Confidence

- High: strong evidence and clear architectural impact.
- Medium: real concern but impact depends on growth or context.
- Low: vague or speculative; remove it.

## Output Requirements

Return FINAL JSON:

[
  {
    "index": 1,
    "fileName": "example.js",
    "filePath": "src/services/example.js",
    "title": "Service mixes API response formatting with domain orchestration",
    "description": "The service contains transport-specific response formatting alongside domain orchestration, making it harder to reuse and evolve the service independently.",
    "suggestion": "Move response formatting to the controller layer and keep this service focused on domain operations.",
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

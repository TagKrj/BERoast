# Interaction Validation Rules (Phase 2 - Precision & Filtering)

## Purpose

Validate interaction findings and keep only issues that can affect real user workflows or frontend-backend behavior.

## Validation Criteria

- Evidence must show a user action, API interaction, form flow, loading state, error state, or data contract.
- Remove purely visual/design preferences unless they affect task completion.
- Remove findings that are not visible to users or API consumers.
- Merge duplicate findings in the same interaction flow.

## Output Requirements

Return FINAL JSON:

[
  {
    "index": 1,
    "fileName": "AnalyzeView.jsx",
    "filePath": "src/pages/AnalyzeView.jsx",
    "title": "Analyze action lacks failure feedback",
    "description": "The UI starts an analysis request but does not present a clear user-facing error state when the request fails.",
    "suggestion": "Show a localized error alert and keep the user on the analysis screen with a retry action.",
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

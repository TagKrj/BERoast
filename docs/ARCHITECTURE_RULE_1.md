# Architecture Detection Rules (Phase 1 - Detection)

## Purpose

Detect potential architecture issues with high recall. This phase should include plausible concerns and attach concrete evidence.

## Architecture Issue Definition

An architecture issue is a structural problem that weakens modularity, boundaries, dependency direction, or long-term project organization.

## Categories

### Boundary Violations
- UI code directly performs backend/data-access responsibilities.
- Controllers contain persistence, validation, and response formatting in one place.
- Services depend on presentation or transport-specific details.

### Layering Problems
- Lower-level modules import higher-level modules.
- Business rules are mixed with route handlers or UI components.
- Infrastructure concerns leak into domain logic.

### Tight Coupling
- A module imports many unrelated modules.
- Components/services know too much about other layers.
- Shared utilities become catch-all modules.

### Low Cohesion
- One file or module handles unrelated responsibilities.
- Names do not match the responsibilities inside the module.

### Architectural Drift
- Similar responsibilities are implemented in different locations.
- Project structure suggests one architecture but code behavior follows another.

## Heuristic Metrics

- boundary_clarity: clear / partial / weak
- coupling_level: low / medium / high
- module_cohesion: high / medium / low
- dependency_direction: clear / mixed / reversed
- layering_risk: low / medium / high

## Output Requirements

Return a RAW detection JSON list:

[
  {
    "fileName": "example.js",
    "filePath": "src/services/example.js",
    "architectureConcern": "Boundary Violation",
    "category": "Boundary Violations",
    "title": "Service mixes API response formatting with domain orchestration",
    "description": "The module combines service orchestration and HTTP response formatting, which weakens layer separation.",
    "suggestion": "Move HTTP-specific formatting to the controller and keep the service focused on domain orchestration.",
    "evidence": "Concrete snippet or observable structure",
    "startLine": 1,
    "endLine": 1,
    "priority": "P1",
    "metrics": {
      "boundary_clarity": "weak",
      "coupling_level": "medium",
      "module_cohesion": "low",
      "dependency_direction": "mixed",
      "layering_risk": "medium"
    }
  }
]

Priority definitions:
- P0: Production blocker. Must be fixed before deployment.
- P1: Must address before scaling. May not block the MVP, but must be addressed before significant growth.
- P2: Should address during continued development. Should be included in the near-term development backlog.
- P3: Acceptable MVP debt. Acceptable temporarily; monitor and revisit later.

If no issues are found, return:

[]

Do not validate strictly in this phase. Prefer high recall.

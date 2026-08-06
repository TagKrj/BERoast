# Interaction Detection Rules (Phase 1 - Detection)

## Purpose

Detect user-flow and frontend-backend interaction issues with high recall.

## Interaction Issue Definition

An interaction issue is code that can confuse users, break expected UI/API workflows, hide important feedback, or make user actions unreliable.

## Categories

### Loading And Pending States
- Long-running actions lack visible loading state.
- Submit buttons remain enabled during pending requests.

### Error Feedback
- API errors are ignored or only logged.
- Users do not receive actionable failure messages.

### Success Feedback
- Mutations complete without visible confirmation or UI update.

### API Contract Alignment
- Frontend expects fields that backend does not return.
- Backend returns data shape that frontend does not handle.

### Form And Navigation Flow
- Inputs are submitted without client-side validation.
- Redirect/callback flows do not handle missing tokens or error states.

## Heuristic Metrics

- user_feedback_quality: strong / partial / weak
- loading_state_coverage: strong / partial / missing
- error_state_coverage: strong / partial / missing
- api_contract_alignment: aligned / partial / risky
- form_flow_resilience: strong / partial / weak

## Output Requirements

Return a RAW detection JSON list with fileName, filePath, interactionConcern, category, title, description, suggestion, evidence, startLine, endLine, priority, and metrics.

Priority must be P0, P1, P2, or P3.

If no issues are found, return:

[]

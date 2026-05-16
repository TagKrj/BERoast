# Security Validation Rules (Phase 2 - Precision & Filtering)

## 1. Purpose

This document defines validation rules for security issues after detection.

Objectives:

- Increase precision.
- Remove false positives.
- Keep only well-supported security issues.
- Standardize final output.

---

## 2. Validation Principles

- Prioritize precision over recall.
- Only retain issues with concrete evidence.
- Every issue must match a security category from Rule 1.
- Do not keep speculative or weak detections.

---

## 3. Validation Criteria

A security issue is valid only if it satisfies all conditions:

### 3.1 Rule Matching

- Must satisfy Rule 1 category conditions.
- Must represent a realistic exploit path or security weakness.

### 3.2 Strong Evidence

- Must include a relevant code snippet or exact observable pattern.
- Must show how untrusted input, missing control, or sensitive data is involved.

### 3.3 Context Awareness

- Test-only code should normally be removed unless it clearly affects production behavior.
- Internal-only helpers should be downgraded or removed if no exploitable path exists.
- Public routes, request handlers, external calls, config, and secrets deserve stricter review.

### 3.4 Metric Support

- `tainted_input_flow = clear` supports injection, SSRF, path traversal, and XSS.
- `auth_boundary = none` supports auth/authz issues.
- `dangerous_api_usage = clear` supports command execution, dynamic evaluation, or unsafe file/network operations.
- `sensitive_data_exposure = clear` supports secret/data exposure issues.

---

## 4. Confidence Scoring

### High Confidence

- Clear rule match.
- Strong supporting evidence.
- Realistic exploit path or concrete unsafe behavior.

### Medium Confidence

- Partial rule match.
- Evidence is real, but exploitability depends on context.

### Low Confidence

- Weak evidence.
- No clear exploit path.
- Mostly speculative.

MUST BE REMOVED.

---

## 5. Filtering Rules

Remove an issue if:

- Evidence is vague or missing.
- The issue depends entirely on assumptions.
- It is only a best-practice concern without a realistic security impact.
- It duplicates another issue in the same region.
- It is test-only and not connected to production behavior.

Merge issues if:

- Multiple detections describe the same vulnerability in the same code region.

Deduplicate if:

- Same vulnerability type and same location.

---

## 6. Output Requirements

Each validated security issue MUST include:

index
fileName
filePath
title
description
startLine
endLine
severity
severityDisplay

Output MUST follow this FINAL JSON structure:

[
{
"index": 1,
"fileName": "repo.service.js",
"filePath": "src/services/repo.service.js",
"title": "Server fetches untrusted URL without SSRF controls",
"description": "The service accepts a user-provided URL and performs a server-side request without host allowlisting or private-network blocking.",
"startLine": 22,
"endLine": 38,
"severity": "high",
"severityDisplay": "High"
}
]

If no valid security issues remain:

[]

---

## 7. Important Constraints

- Do NOT include issues with confidence = low.
- Keep output clean and deduplicated.
- Prefer fewer high-quality findings over noisy output.

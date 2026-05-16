# Security Detection Rules (Phase 1 - Detection)

## 1. Purpose

This document defines the rules and heuristics for detecting potential security issues.

This phase focuses on:

- Identifying ALL possible vulnerabilities and risky patterns.
- Providing supporting evidence.
- Estimating security risk metrics.

DO NOT perform strict validation or filtering.

---

## 2. Definition: Security Issue

A security issue is code or configuration that may allow:

- Unauthorized access.
- Data exposure.
- Code execution.
- Injection.
- Abuse of trusted systems.
- Weaknesses in authentication, authorization, validation, encryption, or secret handling.

---

## 3. Detection Principles

During detection:

- Be INCLUSIVE and high recall.
- Include uncertain but plausible risks.
- Attach concrete evidence for every detection.
- Prefer over-detection during this phase.

---

## 4. Security Categories

### 4.1 Injection

Detect possible:

- SQL/NoSQL injection.
- Command injection.
- Template injection.
- LDAP/query injection.

Indicators:

- User-controlled input used in commands or queries.
- String concatenation into queries.
- Dynamic execution APIs.

### 4.2 Cross-Site Scripting

Detect possible:

- Direct HTML rendering from user input.
- Unsafe DOM insertion.
- Missing output encoding.

Indicators:

- `innerHTML`, `dangerouslySetInnerHTML`, raw template output.
- User input rendered without sanitization.

### 4.3 Authentication And Authorization

Detect possible:

- Missing authentication on sensitive routes.
- Missing ownership checks.
- Role checks implemented incorrectly.
- Trusting client-provided user IDs.

### 4.4 Secrets And Sensitive Data

Detect possible:

- Hardcoded API keys, tokens, passwords.
- Secrets logged to console.
- Sensitive data returned in API responses.

### 4.5 Cryptography

Detect possible:

- Weak hashing or encryption.
- Hardcoded cryptographic keys.
- Insecure randomness for tokens.

### 4.6 Server-Side Request Forgery

Detect possible:

- Fetching arbitrary user-provided URLs from the server.
- Missing allowlist or private-network blocking.

### 4.7 Path Traversal And File Handling

Detect possible:

- User input used in file paths.
- Missing path normalization.
- Unsafe upload handling.

### 4.8 Insecure Configuration

Detect possible:

- Overly permissive CORS.
- Disabled security headers.
- Debug mode in production.
- Missing rate limits on expensive or sensitive endpoints.

---

## 5. Heuristic Metrics

Use approximate estimation:

- tainted_input_flow:
  - none / possible / clear
- auth_boundary:
  - none / partial / strong
- validation_strength:
  - none / weak / strong
- dangerous_api_usage:
  - none / possible / clear
- sensitive_data_exposure:
  - none / possible / clear

---

## 6. Output Requirements (Detection Phase)

Each detected security issue MUST include:

fileName
filePath
vulnerability name
category
title
description
evidence
startLine
endLine
severity
heuristic metrics

Output MUST follow this RAW detection JSON structure:

[
{
"fileName": "auth.controller.js",
"filePath": "src/controllers/auth.controller.js",
"vulnerability": "Missing Authorization Check",
"category": "Authentication And Authorization",
"title": "Route trusts client-provided user ID",
"description": "The code uses a user ID from request input without verifying ownership.",
"evidence": "const user = await User.findById(req.body.userId)",
"startLine": 12,
"endLine": 18,
"severity": "high",
"metrics": {
"tainted_input_flow": "clear",
"auth_boundary": "none",
"validation_strength": "weak",
"dangerous_api_usage": "none",
"sensitive_data_exposure": "possible"
}
}
]

If no security issues are found:

[]

DO NOT:

- assign confidence.
- validate precision strictly.
- remove weak issues.
- merge issues.
- generate final backend response format yet.

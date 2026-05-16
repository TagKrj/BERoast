# Code Smell Validation Rules (Rule 2 – Precision & Filtering)

## 1. Purpose

This document defines the validation rules for code smells after the detection phase.

**Objectives:**
- Increase precision
- Eliminate false positives
- Standardize the final output

---

## 2. Validation Principles

- Prioritize precision over recall  
- Only retain smells with clear and strong evidence  
- Every smell must conform to its formal definition  
- Do not retain speculative or weak detections  

---

## 3. Validation Criteria

A code smell is considered valid only if it satisfies all of the following:

### 3.1 Rule Matching
- Must satisfy the conditions defined in Rule 1  
- Must not violate the formal definition of the smell  

---

### 3.2 Strong Evidence
- Must include a clear and relevant code snippet  
- Must show concrete and observable symptoms (no vague assumptions)  

---

### 3.3 Metric Support
- Heuristic metrics should support the detection:

  - High `method_length` → Long Method  
  - Large `class_size` → Large Class  
  - High `external_dependency_ratio` → Feature Envy  

---

### 3.4 Consistency
- The reasoning must logically align with the evidence  
- No contradictions between explanation and code  

---

## 4. Confidence Scoring

### High Confidence
- Clear rule match  
- Strong supporting evidence  
- Metrics strongly support the conclusion  

---

### Medium Confidence
- Partial rule match  
- Some supporting evidence, but not strong  
- Metrics are borderline  

---

### Low Confidence
- Weak or unclear evidence  
- Does not sufficiently satisfy rule conditions  

> ⚠ MUST BE REMOVED

---

## 5. Filtering Rules

### Remove a smell if:
- No clear code snippet is provided  
- Reasoning is vague (e.g., “seems like”, “might be”)  
- Metrics do not support the claim  
- Does not match the rule definition  

---

### Merge smells if:
- Multiple instances of the same smell exist in the same code region  

→ Merge into a single consolidated report  

---

### Deduplicate if:
- Same smell type AND same location  

---

## 6. Output Requirements

Each validated code smell MUST include:

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
    "fileName": "App.js",
    "filePath": "src/App.js",
    "title": "Long method with deep nesting",
    "description": "The function contains excessive logic, multiple responsibilities, and deep conditional nesting, reducing readability and maintainability.",
    "startLine": 12,
    "endLine": 86,
    "severity": "medium",
    "severityDisplay": "Medium"
  }
]

---

## 7. Notes

- Do not retain a smell simply because it *might* be correct  
- Prefer fewer but highly accurate results  
- Output must be clean, consistent, and well-structured  
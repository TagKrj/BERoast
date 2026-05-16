# Code Smell Detection Rules (Phase 1 - Detection)

## 1. Purpose

This document defines the rules and heuristics for detecting potential code smells.

This phase focuses on:
- Identifying ALL possible smells (high recall)
- Providing supporting evidence
- Estimating structural metrics

DO NOT perform strict validation or filtering.

---

## 2. Definition: Code Smell

A code smell is a structural or design issue that:
- Reduces maintainability, readability, or extensibility
- Suggests need for refactoring
- Does not necessarily break functionality

---

## 3. Detection Principles

During detection:

- Be INCLUSIVE → include possible smells
- Use rule-based reasoning
- Prefer over-detection than missing issues
- Attach evidence for every detection

---

## 4. Code Smell Categories

### 4.1 Bloaters

#### Long Method
- Method length > 50 lines
- Multiple responsibilities
- Deep nesting (>= 3)

#### Large Class
- Too many methods (>10)
- Handles unrelated logic

#### Data Clumps
- Same group of parameters repeated

#### Long Parameter List
- >5 parameters

#### Primitive Obsession
- Overuse of primitive types instead of objects

---

### 4.2 Change Preventers

#### Divergent Change
- Class changes for multiple reasons

#### Shotgun Surgery
- One change affects many files

#### Parallel Inheritance
- Similar class hierarchies duplicated

---

### 4.3 Couplers

#### Feature Envy
- Method relies more on external class than its own

Indicators:
- Frequent access to other objects
- Low internal cohesion

#### Message Chains
- Deep chaining (a.b.c.d)

#### Middle Man
- Class only delegates calls

#### Inappropriate Intimacy
- Accessing internal data of another class

---

### 4.4 Dispensables

#### Duplicate Code
- Similar logic repeated

#### Dead Code
- Unused variables/functions/imports

#### Lazy Class
- Class does very little

#### Data Class
- Only getters/setters, no logic

---

### 4.5 OO Abusers

#### Switch Statements
- Complex switch/if chains

#### Temporary Field
- Field used only in specific cases

#### Refused Bequest
- Subclass ignores parent behavior

---

## 5. Heuristic Metrics (IMPORTANT)

Use approximate estimation:

- method_length:
  - short (<20)
  - medium (20-50)
  - long (>50)

- class_size:
  - small / medium / large

- nesting_depth:
  - shallow (<2)
  - medium (2-3)
  - deep (>3)

- external_dependency_ratio:
  - low / medium / high

- duplication_signals:
  - yes / no

---

## 6. Output Requirements (Detection Phase)

Each detected smell MUST include:

fileName
filePath
smell name
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
    "fileName": "App.js",
    "filePath": "src/App.js",
    "smell": "Long Method",
    "category": "Bloaters",
    "title": "Long method with deep nesting",
    "description": "The method appears excessively long and handles multiple responsibilities with deep conditional nesting.",
    "evidence": "Nested if/else blocks and multiple unrelated operations inside the same function.",
    "startLine": 12,
    "endLine": 86,
    "severity": "medium",
    "metrics": {
      "method_length": "long",
      "class_size": "medium",
      "nesting_depth": "deep",
      "external_dependency_ratio": "medium",
      "duplication_signals": "no"
    }
  }
]

Rules:

severity must be:
low
medium
high
startLine and endLine must be estimated if exact values are unavailable.
title must be short, readable, and UI-friendly.
description must clearly explain why the smell was detected.
evidence should contain either:
a relevant code snippet
or a structural explanation from the source code.

If no smells are found:

[]

DO NOT:

assign confidence
validate precision strictly
remove weak smells
merge smells
generate final backend response format yet

---

## 7. Important Constraints

- Do NOT hallucinate nonexistent code
- Do NOT skip potential smells
- Do NOT merge multiple smells into one
- Each smell must be independent
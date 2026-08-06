# Operational Detection Rules (Phase 1 - Detection)

## Purpose

Detect deployment and runtime readiness concerns with high recall.

## Operational Issue Definition

An operational issue is code or configuration that can make the system difficult to deploy, operate, monitor, scale, or recover in production.

## Categories

### Configuration Safety
- Required environment variables are not validated.
- Defaults are unsafe for production.
- Localhost URLs are hardcoded in production paths.

### Runtime Safety
- Missing rate limits for expensive endpoints.
- Missing health checks.
- Missing request size limits or unsafe CORS.

### Observability
- No useful logs for important failures.
- Sensitive values may be logged.
- Errors are hidden without traceable context.

### Deployment Readiness
- Docker, CI, build scripts, or start scripts are missing or inconsistent.
- Environment examples are incomplete.

### Cost And Quota Risk
- Expensive AI or third-party calls lack quotas, caching, or concurrency limits.

## Heuristic Metrics

- config_safety: strong / partial / weak
- observability_coverage: strong / partial / weak
- deployment_readiness: strong / partial / weak
- runtime_safety: strong / partial / weak
- cost_or_rate_limit_risk: low / medium / high

## Output Requirements

Return a RAW detection JSON list with fileName, filePath, operationalConcern, category, title, description, suggestion, evidence, startLine, endLine, priority, and metrics.

Priority must be P0, P1, P2, or P3.

If no issues are found, return:

[]

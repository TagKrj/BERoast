# BERoast Backend Control Room

> The source of truth for the BERoast backend. Any changes inside `src/` must follow this document before being merged.

## Purpose

This repository is the Node.js + Express + MongoDB backend for BERoast. The goal is not just to make the API work, but to maintain a clean, secure, testable, and AI-friendly architecture with clearly separated responsibilities.

## Read Before Doing Anything Else

Any agent or AI working in this repository should read the following in order:

1. [.agent/ARCHITECTURE.md](.agent/ARCHITECTURE.md)
2. [.agent/agents/backend-specialist.md](.agent/agents/backend-specialist.md)
3. [.agent/agents/orchestrator.md](.agent/agents/orchestrator.md)
4. [.agent/agents/explorer-agent.md](.agent/agents/explorer-agent.md)
5. [.agent/agents/documentation-writer.md](.agent/agents/documentation-writer.md)
6. [.agent/agents/code-archaeologist.md](.agent/agents/code-archaeologist.md)
7. [.agent/skills/nodejs-best-practices/SKILL.md](.agent/skills/nodejs-best-practices/SKILL.md)
8. [.agent/skills/lint-and-validate/SKILL.md](.agent/skills/lint-and-validate/SKILL.md)

## Current Codebase Status

The full analysis pipeline is implemented. Current structure:

```text
src/
├── app.js                  middleware, routes, error handler
├── server.js               entry point, DB connect, Swagger UI
├── config/                 db.js, swagger.js
├── controllers/            auth, repo, roast
├── middlewares/            auth (JWT), error
├── models/                 user, repository, roastRun, roastIssue,
│                           analysisUsage, analysisFileCache
├── routes/                 auth, repo, roast
├── services/
│   ├── githubAuth.service.js   GitHub OAuth
│   ├── githubRepo.service.js   repo tree, ignore rules, file selection
│   ├── roast.service.js        check/analyze flow, quota, report shape
│   ├── aiAnalysis.service.js   size classification, scoring, grading
│   └── analysis/               per-domain detection -> validation pipeline
└── utils/
```

* The six analysis domains are declared in `src/services/analysis/analysisDomains.js`.
* `docs/*_RULE_1.md` (detection) and `docs/*_RULE_2.md` (validation) are loaded at runtime as prompt input. Editing them changes analyser behaviour without a code change.
* `docs/backend-response-contract.json` is the reference response shape.

## Required Architecture

This repository follows a layered backend architecture:

```text
Request -> Middleware -> Route -> Controller -> Service -> Model -> Response
```

Rules:

* `routes` only register endpoints and related middleware.
* `controllers` only handle HTTP concerns: receive input, call services, return responses.
* `services` contain business logic.
* `models` only contain schemas and data access operations.
* `middlewares` contain auth, validation, rate limiting, error handling, and logging helpers.
* `config` only contains infrastructure and connection configuration.
* `app.js` must not contain business logic.
* `server.js` must not contain business logic.

## File Responsibilities

### `src/app.js`

* Create the Express app.
* Register shared middleware: `express.json`, `cors`, `helmet`, `morgan`, `rate-limit`.
* Mount route modules.
* Register `error.middleware` at the end.
* Do not connect to the database here.
* Do not call `listen` here.

### `src/server.js`

* Load environment variables.
* Call `connectDB()`.
* Start the HTTP server.
* Log startup status.
* Exit the process if DB connection fails.

### `src/config/db.js`

* Only responsible for connecting to MongoDB via Mongoose.
* Use `process.env.MONGO_URI`.
* Exit with an error code if startup fails.

### `src/middlewares/error.middleware.js`

* Centralized error normalization layer.
* Never leak stack traces to clients.
* Minimum standard error response:

```json
{
  "success": false,
  "message": "Server Error"
}
```

### `src/routes/`

* Each domain should have its own route file.
* File naming should follow the `*.routes.js` pattern.
* Routes should only mount controllers and related middleware.

### `src/controllers/`

* Only act as HTTP adapters.
* Do not contain heavy business logic.
* Avoid direct Mongoose operations if logic becomes complex enough for services.

### `src/services/`

* Contain business rules and workflows.
* Can be reused across multiple controllers.
* Should not depend on `req`/`res` unless absolutely necessary.

### `src/models/`

* Contain Mongoose schemas and data methods.
* Never place HTTP logic inside models.

## Technical Conventions

### Module System

The source currently uses `import/export`, so the repository must consistently follow ESM end-to-end. `package.json` must be configured properly so `npm run dev` and `npm start` work reliably.

### Validation

* Validate requests at the boundary using `zod` or an equivalent validator.
* Never trust client input, including internal input.
* Validate before writing to the database or calling sensitive services.

### Security Baseline

* Use `helmet`.
* Use controlled `cors` origins.
* Use `express-rate-limit` for public endpoints.
* Sign-in is GitHub OAuth only; there are no passwords to store.
* Use `jsonwebtoken` when authentication is needed.
* Never hardcode secrets.

### Logging

* Use `morgan` for development request logging.
* Never log sensitive data.
* Log errors at the server layer, not detailed internals to clients.

### CORS Contract

* Development currently points to local frontend `http://localhost:5173`.
* In staging/production, origins must come from env variables or centralized config.

## Response Contract

If the repository uses a unified response format, prefer the following:

```json
{
  "success": true,
  "data": {},
  "message": "Optional message"
}
```

```json
{
  "success": false,
  "message": "Human readable error message"
}
```

If validation fails, an `errors` field may be added, but the format must remain consistent.

## AI Routing Matrix

This is the most important section of the README: choose the correct agent and skill before touching the code.

| Task Type                                      | Default Agent                             | Recommended Skills                                                         |
| ---------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| Explore codebase, map architecture             | `explorer-agent`                          | `architecture`, `plan-writing`, `systematic-debugging`                     |
| Build APIs, controllers, services, middleware  | `backend-specialist`                      | `nodejs-best-practices`, `api-patterns`, `clean-code`, `lint-and-validate` |
| Design schemas, relationships, queries         | `database-architect`                      | `database-design`                                                          |
| Auth, security, rate limiting, input hardening | `security-auditor` + `backend-specialist` | `vulnerability-scanner`, `red-team-tactics`                                |
| Debug bugs or unexpected behavior              | `debugger`                                | `systematic-debugging`                                                     |
| Work with legacy code, brownfield refactors    | `code-archaeologist`                      | `clean-code`, `code-review-checklist`                                      |
| Write or update documentation                  | `documentation-writer`                    | `documentation-templates`                                                  |
| Break down large multi-domain tasks            | `orchestrator`                            | `parallel-agents`, `behavioral-modes`, `plan-writing`, `brainstorming`     |
| Implementation planning / roadmap              | `project-planner`                         | `plan-writing`, `brainstorming`, `architecture`                            |
| Write tests, testing strategy, coverage        | `test-engineer`                           | `testing-patterns`, `tdd-workflow`, `webapp-testing`                       |
| Deployment, CI/CD, runtime operations          | `devops-engineer`                         | `deployment-procedures`, `server-management`                               |
| Performance optimization                       | `performance-optimizer`                   | `performance-profiling`                                                    |

### Skill Selection Rule

For this backend repository, the default skill stack should be:

* `backend-specialist`
* `nodejs-best-practices`
* `api-patterns`
* `clean-code`
* `lint-and-validate`

Only add additional skills when the task truly requires them.

## AI Workflow

When an AI works inside this repository, follow this rhythm:

1. Read this README first.
2. Read `.agent/ARCHITECTURE.md` and the related agents/skills.
3. Identify the correct layer being affected.
4. Create a small hypothesis and test the cheapest thing first before changing code.
5. Change as little as possible in the correct layer.
6. Run validation appropriate for the type of change.
7. If the architecture changes, update this README immediately.

## Non-Negotiable Rules

* Never place business logic inside `app.js` or `server.js`.
* Never call the database directly from routes if the logic becomes non-trivial.
* Never let controllers handle complex business rules directly.
* Never hardcode secrets, sensitive URLs, or production origins.
* Never add a feature without understanding which layer it belongs to.
* Never implement large tasks by randomly editing multiple layers at once.

## Existing Scripts

Current `package.json` scripts:

* `npm run dev` -> runs `nodemon src/server.js`
* `npm start` -> runs `node src/server.js`
* `npm run db:init` -> creates collections and indexes in the `beroast` database

## API Docs

Swagger UI is exposed from `server.js` at:

* `http://localhost:5001/api-docs` with the `PORT` from `.env.example` (the code falls back to 5000 when `PORT` is unset)

If you change `PORT`, the docs URL follows that port automatically.

Notes for Swagger testing:

* Use the JSON response of `GET /api/auth/github` when testing in Swagger UI.
* Set `redirect=false` in Swagger UI. `redirect=true` is meant for direct browser navigation.
* The docs now include example payloads and usage notes directly in the route files.

## Environment Contract

`.env.example` lists every variable. Required for a working local setup:

* `MONGO_URI` - the database name in the URI must be `beroast` (`db:init` targets it).
* `JWT_SECRET` - e.g. `openssl rand -hex 32`.
* `GITHUB_LOCAL_CLIENT_ID` / `GITHUB_LOCAL_CLIENT_SECRET` - a GitHub OAuth app with callback `http://localhost:5001/api/auth/github/callback`. Production uses `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
* `GEMINI_API_KEY` - the system analyser.

Recommended: `GITHUB_TOKEN`, which raises the GitHub API limit from 60 to 5000 requests per hour.

Never commit the real `.env`.

## Definition of Done

A backend change is only considered complete when:

* The correct layer and responsibility boundaries are respected.
* Input validation exists.
* Error handling is clear.
* No secrets or stack traces leak to clients.
* Response contracts remain intact.
* Tests exist if critical business logic is affected.
* This README is updated if architecture or contracts change.

## Final Note

`README.md` is the brain of this repository. If the code and documentation diverge, update either the code or the README so they stay aligned instead of letting them drift apart long-term.

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

At the moment, `src/` is still a foundational skeleton without fully implemented business features. Current structure:

```text
src/
├── app.js
├── server.js
├── config/
│   └── db.js
├── controllers/
├── middlewares/
│   └── error.middleware.js
├── models/
├── routes/
└── services/
```

Meaning of this snapshot:

* `src/app.js` is responsible for wiring middleware, routes, and the global error handler.
* `src/server.js` is the application entry point.
* `src/config/db.js` handles MongoDB connection logic.
* `src/config/swagger.js` defines the OpenAPI document used by Swagger UI.
* `src/middlewares/error.middleware.js` centralizes error handling.
* `controllers`, `routes`, `models`, and `services` are architecture layers waiting for feature implementation.

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
* Hash passwords with `bcrypt`.
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

## API Docs

Swagger UI is exposed from `server.js` at:

* `http://localhost:5000/api-docs` by default

If you change `PORT`, the docs URL follows that port automatically.

Notes for Swagger testing:

* Use the JSON response of `GET /api/auth/github` when testing in Swagger UI.
* Set `redirect=false` in Swagger UI. `redirect=true` is meant for direct browser navigation.
* The docs now include example payloads and usage notes directly in the route files.

Once the backend is fully bootstrapped, these two scripts should remain the standard execution paths.

## Environment Contract

Minimum required environment variables:

* `MONGO_URI` - required for database connection.
* `PORT` - HTTP server port, should have a default.
* `CLIENT_ORIGIN` - frontend origin instead of hardcoding.
* `NODE_ENV` - `development`, `test`, `production`.
* `JWT_SECRET` - required when authentication is enabled.

Recommendations:

* Create a `.env.example`.
* Never commit the real `.env`.
* All secrets must live in environment variables.

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

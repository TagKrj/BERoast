export const ANALYSIS_DOMAIN_KEYS = [
  'maintainability',
  'architecture',
  'security',
  'robustness',
  'operational',
  'interaction',
];

export const ANALYSIS_DOMAINS = {
  maintainability: {
    key: 'maintainability',
    label: 'Maintainability',
    issueNoun: 'maintainability issue',
    detectionRole:
      'senior software engineer specializing in static code analysis and maintainability review',
    validationRole: 'expert in software quality and maintainability validation',
    rule1File: 'CODE_SMELL_RULE_1.md',
    rule2File: 'CODE_SMELL_RULE_2.md',
    rule1Name: 'CODE_SMELL_RULE_1.md',
    rule2Name: 'CODE_SMELL_RULE_2.md',
    rawNameField: 'smell',
    rawNameLabel: 'smell name',
    metrics: [
      'method_length',
      'class_size',
      'nesting_depth',
      'external_dependency_ratio',
      'duplication_signals',
    ],
    detectionFocus:
      'code smells, duplicated logic, long methods, large classes/components, dead code, mixed responsibilities, tight coupling, weak naming, and maintainability risks',
    validationFocus:
      'remove weak maintainability claims, merge duplicates, and keep only issues with clear maintainability impact',
    filePathHints: [
      'src/',
      'components/',
      'controllers/',
      'services/',
      'routes/',
      'hooks/',
      'utils/',
    ],
    scorePenaltyMultiplier: 3,
  },
  architecture: {
    key: 'architecture',
    label: 'Architecture',
    issueNoun: 'architecture issue',
    detectionRole:
      'senior software architect specializing in modularity and boundary analysis',
    validationRole: 'expert in software architecture validation',
    rule1File: 'ARCHITECTURE_RULE_1.md',
    rule2File: 'ARCHITECTURE_RULE_2.md',
    rule1Name: 'ARCHITECTURE_RULE_1.md',
    rule2Name: 'ARCHITECTURE_RULE_2.md',
    rawNameField: 'architectureConcern',
    rawNameLabel: 'architecture concern name',
    metrics: [
      'boundary_clarity',
      'coupling_level',
      'module_cohesion',
      'dependency_direction',
      'layering_risk',
    ],
    detectionFocus:
      'module boundaries, layering, dependency direction, mixed frontend/backend concerns, circular dependencies, misplaced responsibilities, and architectural drift',
    validationFocus:
      'keep only architecture findings with clear boundary, dependency, or modularity evidence',
    filePathHints: [
      'src/',
      'app/',
      'pages/',
      'controllers/',
      'services/',
      'routes/',
      'middleware/',
      'models/',
      'api/',
    ],
    scorePenaltyMultiplier: 5,
  },
  security: {
    key: 'security',
    label: 'Security',
    issueNoun: 'security issue',
    detectionRole:
      'senior application security engineer specializing in static security analysis',
    validationRole: 'expert in application security validation',
    rule1File: 'SECURITY_RULE_1.md',
    rule2File: 'SECURITY_RULE_2.md',
    rule1Name: 'SECURITY_RULE_1.md',
    rule2Name: 'SECURITY_RULE_2.md',
    rawNameField: 'vulnerability',
    rawNameLabel: 'vulnerability name',
    metrics: [
      'tainted_input_flow',
      'auth_boundary',
      'validation_strength',
      'dangerous_api_usage',
      'sensitive_data_exposure',
    ],
    detectionFocus:
      'OWASP-inspired vulnerabilities, injection, XSS, auth/authz weaknesses, secrets exposure, cryptography mistakes, SSRF, path traversal, and insecure configuration',
    validationFocus:
      'remove weak issues without realistic exploit paths and keep production-relevant security findings',
    filePathHints: [
      'auth',
      'login',
      'token',
      'jwt',
      'secret',
      'password',
      'routes/',
      'controllers/',
      'middleware/',
      'api/',
      '.github/workflows/',
      'Dockerfile',
      'docker-compose',
      '.env.example',
    ],
    scorePenaltyMultiplier: 7,
  },
  robustness: {
    key: 'robustness',
    label: 'Robustness',
    issueNoun: 'robustness issue',
    detectionRole:
      'senior backend and frontend engineer specializing in resilient application behavior',
    validationRole: 'expert in robustness and failure-mode validation',
    rule1File: 'ROBUSTNESS_RULE_1.md',
    rule2File: 'ROBUSTNESS_RULE_2.md',
    rule1Name: 'ROBUSTNESS_RULE_1.md',
    rule2Name: 'ROBUSTNESS_RULE_2.md',
    rawNameField: 'robustnessConcern',
    rawNameLabel: 'robustness concern name',
    metrics: [
      'input_validation_strength',
      'error_handling_coverage',
      'null_safety',
      'async_failure_handling',
      'fallback_behavior',
    ],
    detectionFocus:
      'missing validation, weak error handling, null/undefined hazards, async failure handling, retry/fallback behavior, and edge-case resilience',
    validationFocus:
      'keep only robustness findings with concrete failure modes or observable missing defensive handling',
    filePathHints: [
      'controllers/',
      'services/',
      'routes/',
      'middleware/',
      'api/',
      'hooks/',
      'utils/',
      'forms',
    ],
    scorePenaltyMultiplier: 4,
  },
  operational: {
    key: 'operational',
    label: 'Operational',
    issueNoun: 'operational readiness issue',
    detectionRole:
      'senior DevOps engineer specializing in deployment and runtime readiness',
    validationRole: 'expert in operational readiness validation',
    rule1File: 'OPERATIONAL_RULE_1.md',
    rule2File: 'OPERATIONAL_RULE_2.md',
    rule1Name: 'OPERATIONAL_RULE_1.md',
    rule2Name: 'OPERATIONAL_RULE_2.md',
    rawNameField: 'operationalConcern',
    rawNameLabel: 'operational concern name',
    metrics: [
      'config_safety',
      'observability_coverage',
      'deployment_readiness',
      'runtime_safety',
      'cost_or_rate_limit_risk',
    ],
    detectionFocus:
      'environment configuration, deployment readiness, health checks, logging, rate limits, CORS, CI/CD, Docker, scripts, and runtime operational risks',
    validationFocus:
      'keep only operational findings that can affect deployment, monitoring, runtime stability, or production operation',
    filePathHints: [
      'Dockerfile',
      'docker-compose',
      '.env.example',
      '.github/workflows/',
      'package.json',
      'server',
      'app',
      'config',
      'middleware',
    ],
    scorePenaltyMultiplier: 4,
  },
  interaction: {
    key: 'interaction',
    label: 'Interaction',
    issueNoun: 'interaction issue',
    detectionRole:
      'senior product engineer specializing in frontend-backend interaction and user flow reliability',
    validationRole: 'expert in interaction flow validation',
    rule1File: 'INTERACTION_RULE_1.md',
    rule2File: 'INTERACTION_RULE_2.md',
    rule1Name: 'INTERACTION_RULE_1.md',
    rule2Name: 'INTERACTION_RULE_2.md',
    rawNameField: 'interactionConcern',
    rawNameLabel: 'interaction concern name',
    metrics: [
      'user_feedback_quality',
      'loading_state_coverage',
      'error_state_coverage',
      'api_contract_alignment',
      'form_flow_resilience',
    ],
    detectionFocus:
      'user feedback, loading states, error states, form validation, frontend-backend contract mismatches, navigation flow, and interaction reliability',
    validationFocus:
      'keep only interaction findings that are visible to users or can break frontend-backend workflows',
    filePathHints: [
      'pages/',
      'components/',
      'hooks/',
      'services/',
      'api/',
      'forms',
      'store',
      'context',
      'router',
    ],
    scorePenaltyMultiplier: 3,
  },
};

export const analysisDomainValues = () => Object.values(ANALYSIS_DOMAINS);

export const domainIssueCountKey = (domainKey) =>
  `total${domainKey
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;

export const getAnalysisDomain = (domainKey) => ANALYSIS_DOMAINS[domainKey];

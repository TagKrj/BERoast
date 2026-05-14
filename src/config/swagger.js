import swaggerJsdoc from 'swagger-jsdoc';

const port = process.env.PORT || 5000;
const normalizeHttpUrl = (value, fallback) => {
	if (!value) {
		return fallback;
	}
  
	if (/^https?:\/\//i.test(value)) {
		return value;
	}
  
	return `http://${value.replace(/^\/+/, '')}`;
};
const serverUrl = normalizeHttpUrl(
	process.env.API_BASE_URL || process.env.SERVER_URL || process.env.API_URL,
	`http://localhost:${port}`,
);

const swaggerSpec = swaggerJsdoc({
	definition: {
		openapi: '3.0.3',
		info: {
			title: 'BERoast API',
			version: '1.0.0',
			description: 'Swagger UI for the BERoast backend API',
		},
		servers: [
			{
				url: serverUrl,
				description: 'Development server',
			},
		],
		tags: [
			{
				name: 'Health',
				description: 'Health and readiness endpoints',
			},
			{
				name: 'Auth',
				description: 'GitHub OAuth authentication endpoints',
			},
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
				},
			},
			schemas: {
				ErrorResponse: {
					type: 'object',
					required: ['success', 'message'],
					properties: {
						success: {
							type: 'boolean',
							example: false,
						},
						message: {
							type: 'string',
							example: 'Server Error',
						},
						error: {
							type: 'object',
							additionalProperties: true,
						},
					},
				},
				HealthResponse: {
					type: 'object',
					required: ['success', 'data'],
					properties: {
						success: {
							type: 'boolean',
							example: true,
						},
						data: {
							type: 'object',
							required: ['status'],
							properties: {
								status: {
									type: 'string',
									example: 'ok',
								},
							},
						},
					},
				},
				GithubAccount: {
					type: 'object',
					required: [
						'id',
						'username',
						'displayName',
						'email',
						'avatarUrl',
						'profileUrl',
					],
					properties: {
						id: {
							type: 'string',
							example: '123456789',
						},
						username: {
							type: 'string',
							example: 'github-user',
						},
						displayName: {
							type: 'string',
							nullable: true,
							example: 'GitHub User',
						},
						email: {
							type: 'string',
							nullable: true,
							example: 'user@example.com',
						},
						avatarUrl: {
							type: 'string',
							example: 'https://avatars.githubusercontent.com/u/123456789?v=4',
						},
						profileUrl: {
							type: 'string',
							example: 'https://github.com/github-user',
						},
					},
				},
				AuthUser: {
					type: 'object',
					required: ['id', 'name', 'email', 'avatarUrl', 'github'],
					properties: {
						id: {
							type: 'string',
							example: '66cfd1c6b1a5f4f1b3f7e111',
						},
						name: {
							type: 'string',
							example: 'GitHub User',
						},
						email: {
							type: 'string',
							nullable: true,
							example: 'user@example.com',
						},
						avatarUrl: {
							type: 'string',
							example: 'https://avatars.githubusercontent.com/u/123456789?v=4',
						},
						github: {
							$ref: '#/components/schemas/GithubAccount',
						},
					},
				},
				CurrentUser: {
					type: 'object',
					required: ['id', 'name', 'email', 'avatarUrl', 'githubUsername'],
					properties: {
						id: {
							type: 'string',
							example: '66cfd1c6b1a5f4f1b3f7e111',
						},
						name: {
							type: 'string',
							example: 'GitHub User',
						},
						email: {
							type: 'string',
							nullable: true,
							example: 'user@example.com',
						},
						avatarUrl: {
							type: 'string',
							example: 'https://avatars.githubusercontent.com/u/123456789?v=4',
						},
						githubUsername: {
							type: 'string',
							example: 'github-user',
						},
					},
				},
				GithubAuthUrlResponse: {
					type: 'object',
					required: ['success', 'data'],
					properties: {
						success: {
							type: 'boolean',
							example: true,
						},
						data: {
							type: 'object',
							required: ['authUrl'],
							properties: {
								authUrl: {
									type: 'string',
									example:
										'https://github.com/login/oauth/authorize?client_id=...',
								},
							},
						},
					},
				},
				GithubCallbackResponse: {
					type: 'object',
					required: ['success', 'message', 'data'],
					properties: {
						success: {
							type: 'boolean',
							example: true,
						},
						message: {
							type: 'string',
							example: 'Authenticated successfully',
						},
						data: {
							type: 'object',
							required: ['accessToken', 'user'],
							properties: {
								accessToken: {
									type: 'string',
									example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
								},
								user: {
									$ref: '#/components/schemas/AuthUser',
								},
							},
						},
					},
				},
				CurrentUserResponse: {
					type: 'object',
					required: ['success', 'data'],
					properties: {
						success: {
							type: 'boolean',
							example: true,
						},
						data: {
							type: 'object',
							required: ['user'],
							properties: {
								user: {
									$ref: '#/components/schemas/CurrentUser',
								},
							},
						},
					},
				},
			},
		},
	},
	apis: ['./src/app.js', './src/routes/*.js'],
});

export default swaggerSpec;

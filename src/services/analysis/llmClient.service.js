import AppError from '../../utils/appError.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

const stripJsonFence = (value) =>
  value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

export const parseJsonResponse = (value, errorCode) => {
  try {
    return JSON.parse(stripJsonFence(value));
  } catch {
    throw new AppError('AI returned invalid JSON.', 502, errorCode);
  }
};

const callGeminiJson = async ({ prompt, errorPrefix }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError(
      'GEMINI_API_KEY is missing',
      500,
      'GEMINI_API_KEY_MISSING',
    );
  }

  const model = process.env.GEMINI_ANALYSIS_MODEL || DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.15,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new AppError(
      'Gemini analysis failed.',
      502,
      `${errorPrefix}_GEMINI_FAILED`,
    );
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new AppError(
      'Gemini returned an empty response.',
      502,
      `${errorPrefix}_GEMINI_EMPTY_RESPONSE`,
    );
  }

  return {
    model,
    result: parseJsonResponse(text, `${errorPrefix}_GEMINI_JSON_INVALID`),
  };
};

const callOpenAIJson = async ({ prompt, openAiApiKey, errorPrefix }) => {
  if (!openAiApiKey) {
    throw new AppError(
      'Personal OpenAI API key is required for large repositories.',
      400,
      'OPENAI_API_KEY_REQUIRED',
    );
  }

  const model = process.env.OPENAI_ANALYSIS_MODEL || DEFAULT_OPENAI_MODEL;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a senior static analysis assistant. Return only valid JSON matching the requested schema.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new AppError(
      'OpenAI analysis failed.',
      502,
      `${errorPrefix}_OPENAI_FAILED`,
    );
  }

  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content;

  if (!text) {
    throw new AppError(
      'OpenAI returned an empty response.',
      502,
      `${errorPrefix}_OPENAI_EMPTY_RESPONSE`,
    );
  }

  return {
    model,
    result: parseJsonResponse(text, `${errorPrefix}_OPENAI_JSON_INVALID`),
  };
};

export const callProviderJson = async ({
  prompt,
  provider,
  openAiApiKey,
  errorPrefix,
}) =>
  provider === 'user_openai'
    ? callOpenAIJson({ prompt, openAiApiKey, errorPrefix })
    : callGeminiJson({ prompt, errorPrefix });

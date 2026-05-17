import AppError from '../../utils/appError.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const LLM_RETRY_COUNT = Number.parseInt(process.env.LLM_RETRY_COUNT || '2', 10);
const LLM_RETRY_DELAY_MS = Number.parseInt(
  process.env.LLM_RETRY_DELAY_MS || '1200',
  10,
);
const LLM_REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.LLM_REQUEST_TIMEOUT_MS || '45000',
  10,
);

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

const wait = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const shouldRetryStatus = (status) =>
  [408, 409, 425, 429, 500, 502, 503, 504].includes(status);

const readErrorBody = async (response) => {
  try {
    const text = await response.text();
    return text.slice(0, 500);
  } catch {
    return '';
  }
};

const createTimeoutSignal = () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, LLM_REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
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
  let response;

  for (let attempt = 0; attempt <= LLM_RETRY_COUNT; attempt += 1) {
    const timeout = createTimeoutSignal();

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          signal: timeout.signal,
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
    } catch (error) {
      if (error.name !== 'AbortError' || attempt === LLM_RETRY_COUNT) {
        throw new AppError(
          'Gemini analysis timed out.',
          502,
          `${errorPrefix}_GEMINI_TIMEOUT`,
        );
      }

      await wait(LLM_RETRY_DELAY_MS * (attempt + 1));
      continue;
    } finally {
      timeout.clear();
    }

    if (
      response.ok ||
      !shouldRetryStatus(response.status) ||
      attempt === LLM_RETRY_COUNT
    ) {
      break;
    }

    await wait(LLM_RETRY_DELAY_MS * (attempt + 1));
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    const statusCode = [401, 403].includes(response.status) ? 401 : 502;
    throw new AppError(
      `OpenAI analysis failed with status ${response.status}. ${body}`,
      statusCode,
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
  let response;

  for (let attempt = 0; attempt <= LLM_RETRY_COUNT; attempt += 1) {
    const timeout = createTimeoutSignal();

    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        signal: timeout.signal,
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
    } catch (error) {
      if (error.name !== 'AbortError' || attempt === LLM_RETRY_COUNT) {
        throw new AppError(
          'OpenAI analysis timed out.',
          502,
          `${errorPrefix}_OPENAI_TIMEOUT`,
        );
      }

      await wait(LLM_RETRY_DELAY_MS * (attempt + 1));
      continue;
    } finally {
      timeout.clear();
    }

    if (
      response.ok ||
      !shouldRetryStatus(response.status) ||
      attempt === LLM_RETRY_COUNT
    ) {
      break;
    }

    await wait(LLM_RETRY_DELAY_MS * (attempt + 1));
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new AppError(
      `Gemini analysis failed with status ${response.status}. ${body}`,
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

/**
 * OpenRouter client using OpenAI-compatible chat completions and tool calling.
 */

function openRouterChat_(messages, tools, options) {
  assertConfigured_();

  const opts = options || {};
  const model = opts.model || getDefaultAgentModel_();

  const payload = {
    model: model,
    messages: messages,
    temperature: opts.temperature === undefined ? 0.1 : opts.temperature,
    max_tokens: opts.maxTokens || 4000
  };

  if (Array.isArray(tools) && tools.length) {
    payload.tools = tools;
    payload.tool_choice = opts.toolChoice || 'auto';
    // Apps Script executes tools serially; asking the model for one at a time
    // makes validation, auditing, and recovery easier.
    payload.parallel_tool_calls = false;
  }

  const response = UrlFetchApp.fetch(AI_AGENT_CONFIG.OPENROUTER_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + getOpenRouterApiKey_(),
      'HTTP-Referer': 'https://script.google.com',
      'X-Title': 'Google Workspace AI Agent'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  const json = safeJsonParse_(body, null);

  if (code < 200 || code >= 300 || !json) {
    throw new Error('OpenRouter HTTP ' + code + ': ' + body.slice(0, 2000));
  }

  if (json.error) {
    throw new Error(
      'OpenRouter error: ' +
      (json.error.message || jsonStringifySafe_(json.error, 2000))
    );
  }

  if (!json.choices || !json.choices.length || !json.choices[0].message) {
    throw new Error('OpenRouter returned no assistant message.');
  }

  return {
    model: json.model || model,
    message: json.choices[0].message,
    usage: json.usage || null
  };
}

function normalizeAssistantToolMessage_(message) {
  const normalized = {
    role: 'assistant',
    content: message.content === null || message.content === undefined
      ? ''
      : String(message.content)
  };

  if (Array.isArray(message.tool_calls)) {
    normalized.tool_calls = message.tool_calls.map(function(call) {
      return {
        id: String(call.id),
        type: 'function',
        function: {
          name: String(call.function && call.function.name || ''),
          arguments: (call.function && typeof call.function.arguments === 'string')
            ? call.function.arguments
            : JSON.stringify(call.function && call.function.arguments || {})
        }
      };
    });
  }
  return normalized;
}

function testOpenRouterConnection() {
  const result = openRouterChat_(
    [
      {
        role: 'user',
        content: 'Reply with exactly: OpenRouter connected'
      }
    ],
    [],
    { maxTokens: 50, temperature: 0 }
  );
  return {
    success: true,
    model: result.model,
    response: String(result.message.content || '')
  };
}

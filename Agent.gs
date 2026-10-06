/**
 * Core agent loop.
 */

function buildAgentSystemPrompt_(session) {
  const hostSpreadsheetId = getAgentProperty_('AI_HOST_SPREADSHEET_ID', '');
  const context = session.context || {};

  return [
    'You are a Google Workspace AI agent running inside Google Apps Script.',
    'You can use the provided tools to search and operate Google Drive, Docs, Sheets, and Slides.',
    '',
    'OPERATING RULES:',
    '1. Use tools when the user asks you to inspect, create, or modify Workspace content.',
    '2. Never invent a file ID. Search Drive first unless an ID is already known.',
    '3. For new presentations, prefer slides_create_deck so the whole deck is created consistently in one operation.',
    '4. Before making a targeted edit to an existing Doc or Slides file, read it when necessary to understand the current content.',
    '5. For spreadsheet data, read only the range needed. Do not request huge raw ranges.',
    '6. The specialized sheet_calculate_current tool can use the existing CalculationEngine for the host spreadsheet.',
    '7. Do not claim an action succeeded until the tool result says success=true.',
    '8. If a tool fails because of bad arguments, correct the arguments and retry when safe.',
    '9. There are deliberately no delete/trash tools. Explain this if the user asks for deletion.',
    '10. Keep the final answer concise and include file links returned by tools.',
    '',
    'HOST SPREADSHEET ID: ' + (hostSpreadsheetId || '(not recorded)'),
    'CURRENT SESSION CONTEXT: ' + JSON.stringify(context),
    '',
    'When creating presentation content, write complete slide-ready content, not placeholders.',
    'When a user asks for a complete deliverable, complete it with tools rather than merely describing steps.'
  ].join('\n');
}

function runAgent_(userText, runtime) {
  assertConfigured_();

  const started = Date.now();
  const session = loadSession_(runtime.sessionKey, {
    channel: runtime.channel,
    userId: runtime.userId,
    chatId: runtime.chatId,
    model: getDefaultAgentModel_()
  });

  const systemMessage = {
    role: 'system',
    content: buildAgentSystemPrompt_(session)
  };

  const priorHistory = trimHistory_(session.history || []);
  const messages = [systemMessage].concat(priorHistory);
  const userMessage = {
    role: 'user',
    content: String(userText || '').trim()
  };
  messages.push(userMessage);

  const tools = getAgentToolSchemas_();
  let finalText = '';
  let finalModel = session.model;

  for (let step = 0; step < AI_AGENT_CONFIG.MAX_TOOL_STEPS; step++) {
    if (Date.now() - started > AI_AGENT_CONFIG.AGENT_SOFT_TIME_LIMIT_MS) {
      finalText =
        'I completed the work that fit within this run. ' +
        'Send "continue" and I will continue from the saved file context.';
      break;
    }

    let response;
    try {
      response = openRouterChat_(messages, tools, {
        model: session.model,
        temperature: 0.1,
        maxTokens: 5000,
        toolChoice: 'auto'
      });
    } catch (e) {
      // If a specifically selected model is temporarily unavailable, use the
      // free feature-aware router once as a fallback.
      if (session.model !== AI_AGENT_CONFIG.FALLBACK_MODEL) {
        response = openRouterChat_(messages, tools, {
          model: AI_AGENT_CONFIG.FALLBACK_MODEL,
          temperature: 0.1,
          maxTokens: 5000,
          toolChoice: 'auto'
        });
      } else {
        throw e;
      }
    }

    finalModel = response.model || session.model;
    const assistant = normalizeAssistantToolMessage_(response.message);
    const toolCalls = Array.isArray(assistant.tool_calls)
      ? assistant.tool_calls
      : [];

    if (!toolCalls.length) {
      finalText = String(assistant.content || '').trim();
      if (!finalText) finalText = 'Done.';
      break;
    }

    messages.push(assistant);

    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i];
      const toolName = String(call.function.name || '');
      const parsedArgs = safeJsonParse_(call.function.arguments, null);
      let result;

      if (!parsedArgs) {
        result = {
          success: false,
          error: 'Tool arguments were not valid JSON.'
        };
      } else {
        try {
          result = executeAgentTool_(toolName, parsedArgs, session);
        } catch (toolError) {
          result = {
            success: false,
            error: normalizeError_(toolError)
          };
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: jsonStringifySafe_(
          result,
          AI_AGENT_CONFIG.MAX_TOOL_RESULT_CHARS
        )
      });
    }
  }

  if (!finalText) {
    const finalResponse = openRouterChat_(messages, tools, {
      model: finalModel || session.model,
      temperature: 0.1,
      maxTokens: 2000,
      toolChoice: 'none'
    });
    finalText = String(finalResponse.message.content || '').trim() ||
      'The requested operations finished.';
  }

  session.history = trimHistory_(
    priorHistory.concat([
      userMessage,
      { role: 'assistant', content: finalText }
    ])
  );
  saveSession_(session);

  return finalText;
}

/**
 * Synchronous entry point for the Google Sheets sidebar.
 */
function runAgentFromSidebar(userText) {
  const userKey = Session.getTemporaryActiveUserKey() || 'owner';
  const sessionKey = 'sidebar:' + userKey;
  const defaults = {
    channel: 'sidebar',
    userId: userKey,
    chatId: ''
  };

  const command = handleAgentCommand_(userText, sessionKey, defaults);
  if (command.handled) return command.text;

  return runAgent_(userText, {
    sessionKey: sessionKey,
    channel: 'sidebar',
    userId: userKey,
    chatId: ''
  });
}

function resetSidebarAgentSession() {
  const userKey = Session.getTemporaryActiveUserKey() || 'owner';
  resetSession_('sidebar:' + userKey, {
    channel: 'sidebar',
    userId: userKey,
    chatId: ''
  });
  return { success: true };
}

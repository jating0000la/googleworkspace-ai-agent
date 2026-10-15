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
  // Queue workers pass their own absolute deadline so each job shares the
  // worker's remaining time instead of receiving another full agent budget.
  const deadlineMs = Math.min(
    started + AI_AGENT_CONFIG.AGENT_SOFT_TIME_LIMIT_MS,
    Number.isFinite(runtime.deadlineMs) ? runtime.deadlineMs : Infinity
  );
  const timeLimitMessage =
    'This run reached its time limit. I saved the available file context; ' +
    'ask me to continue if more work is needed.';
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
    if (Date.now() >= deadlineMs) {
      finalText = timeLimitMessage;
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
        if (Date.now() >= deadlineMs) {
          finalText = timeLimitMessage;
          break;
        }
        response = openRouterChat_(messages, tools, {
          model: AI_AGENT_CONFIG.FALLBACK_MODEL,
          temperature: 0.1,
          maxTokens: 5000,
          toolChoice: 'auto'

/**
 * Installation, UI, and settings.
 */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🤖 Workspace Agent')
      .addItem('Open Agent', 'showAgentSidebar')
      .addSeparator()
      .addItem('Install / Repair Agent', 'installAgent')
      .addItem('Process Queue Now', 'processAgentQueueFromMenu')
      .addItem('Telegram / Queue Diagnostics', 'showTelegramQueueDiagnostics')
      .addItem('Clear Telegram Retry Backlog', 'installTelegramWebhookClean')
      .addToUi();
  } catch (e) {
    console.warn('onOpen UI unavailable: ' + normalizeError_(e));
  }
}

function showAgentSidebar() {
  const html = HtmlService
    .createHtmlOutputFromFile('Agent_Sidebar')
    .setTitle('Workspace AI Agent');
  SpreadsheetApp.getUi().showSidebar(html);
}

function installAgent() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    setAgentProperty_('AI_HOST_SPREADSHEET_ID', active.getId());
  }

  const db = createOrRepairAgentDb_();
  getTelegramWebhookKey_();

  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'processAgentQueue') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('processAgentQueue')
    .timeBased()
    .everyMinutes(1)
    .create();

  return {
    success: true,
    version: AI_AGENT_CONFIG.VERSION,
    databaseId: db.id,
    databaseUrl: db.url,
    hostSpreadsheetId: getAgentProperty_('AI_HOST_SPREADSHEET_ID', ''),
    webAppUrl: ScriptApp.getService().getUrl() || '',
    message:
      'Agent installed. Save API settings in the sidebar, deploy as a Web app, then install the Telegram webhook.'
  };
}

function getAgentSettingsForUi() {
  let dbUrl = '';
  try {
    const id = getAgentProperty_(AI_AGENT_PROPERTIES.DB_ID, '');
    if (id) dbUrl = SpreadsheetApp.openById(id).getUrl();
  } catch (e) {}

  return {
    version: AI_AGENT_CONFIG.VERSION,
    openRouterConfigured: Boolean(getOpenRouterApiKey_()),
    telegramConfigured: Boolean(getTelegramBotToken_()),
    allowedUserIds: getAgentProperty_(
      AI_AGENT_PROPERTIES.TELEGRAM_ALLOWED_USER_IDS,
      ''
    ),
    defaultModel: getDefaultAgentModel_(),
    databaseUrl: dbUrl,
    webAppUrl: ScriptApp.getService().getUrl() || '',
    hostSpreadsheetId: getAgentProperty_('AI_HOST_SPREADSHEET_ID', '')
  };
}

function saveAgentSettings(settings) {
  settings = settings || {};
  const props = agentProps_();

  if (settings.openRouterApiKey && String(settings.openRouterApiKey).trim()) {
    props.setProperty(
      AI_AGENT_PROPERTIES.OPENROUTER_API_KEY,
      String(settings.openRouterApiKey).trim()
    );
  }

  if (settings.telegramBotToken && String(settings.telegramBotToken).trim()) {
    props.setProperty(
      AI_AGENT_PROPERTIES.TELEGRAM_BOT_TOKEN,
      String(settings.telegramBotToken).trim()
    );
  }

  if (settings.allowedUserIds !== undefined) {
    props.setProperty(
      AI_AGENT_PROPERTIES.TELEGRAM_ALLOWED_USER_IDS,
      String(settings.allowedUserIds || '').trim()
    );
  }

  if (settings.defaultModel && String(settings.defaultModel).trim()) {
    props.setProperty(
      AI_AGENT_PROPERTIES.DEFAULT_MODEL,
      String(settings.defaultModel).trim()
    );
  }

  return getAgentSettingsForUi();
}

function clearStoredAgentSecrets() {
  agentProps_().deleteProperty(AI_AGENT_PROPERTIES.OPENROUTER_API_KEY);
  agentProps_().deleteProperty(AI_AGENT_PROPERTIES.TELEGRAM_BOT_TOKEN);
  return { success: true };
}

function diagnoseAgent() {
  const diagnostics = {
    version: AI_AGENT_CONFIG.VERSION,
    dbInstalled: false,
    queueTriggerInstalled: false,
    queueTriggerCount: 0,
    openRouterConfigured: Boolean(getOpenRouterApiKey_()),
    telegramConfigured: Boolean(getTelegramBotToken_()),
    allowedTelegramUsers: getAllowedTelegramUserIds_(),
    webAppUrl: ScriptApp.getService().getUrl() || '',
    calculationEngineInstalled: typeof calculate === 'function'
  };

  try {
    getAgentDb_();
    diagnostics.dbInstalled = true;
  } catch (e) {
    diagnostics.dbError = normalizeError_(e);
  }

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'processAgentQueue') {
      diagnostics.queueTriggerInstalled = true;
      diagnostics.queueTriggerCount++;
    }
  });

  try { diagnostics.recentQueue = getRecentQueueDiagnostics_(5); } catch (e) { diagnostics.queueError = normalizeError_(e); }
  return diagnostics;
}


/** Manual queue run with a visible result. Useful while debugging Telegram. */
function processAgentQueueFromMenu() {
  const result = processAgentQueue();
  try {
    SpreadsheetApp.getUi().alert(
      'Queue run complete',
      'Claimed: ' + result.claimed + '\n' +
      'Processed: ' + result.processed + '\n' +
      'Recovered: ' + result.recovered + '\n\n' +
      JSON.stringify(result.results || [], null, 2).slice(0, 7000),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
  return result;
}

/** Show trigger/settings plus recent queue errors without exposing secrets. */
function showTelegramQueueDiagnostics() {
  const diagnostics = diagnoseAgent();
  diagnostics.recentQueue = getRecentQueueDiagnostics_(5);
  try {
    SpreadsheetApp.getUi().alert(
      'Telegram / Queue Diagnostics',
      JSON.stringify(diagnostics, null, 2).slice(0, 12000),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
  return diagnostics;
}

/** Rebuild only the queue trigger; does not touch Slides or other tools. */
function repairQueueTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'processAgentQueue') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('processAgentQueue')
    .timeBased()
    .everyMinutes(1)
    .create();
  return { success: true, message: 'Queue trigger repaired.' };
}

/** Send a direct Telegram test message to a known private-chat/user id. */
function testTelegramReplyToChat(chatId) {
  if (!chatId) throw new Error('Provide your Telegram chat ID / user ID.');
  telegramSendMessage_(String(chatId), '✅ Direct Telegram send test passed. ' + nowIso_());
  return { success: true, chatId: String(chatId) };
}

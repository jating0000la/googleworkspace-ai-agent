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

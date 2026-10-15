/**
 * Google Workspace AI Agent - Configuration
 * Runtime: Google Apps Script V8
 */
const AI_AGENT_CONFIG = Object.freeze({
  VERSION: '1.0.3',
  OPENROUTER_URL: 'https://openrouter.ai/api/v1/chat/completions',
  DEFAULT_MODEL: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  FALLBACK_MODEL: 'openrouter/free',
  MAX_TOOL_STEPS: 10,
  MAX_HISTORY_MESSAGES: 16,
  MAX_TOOL_RESULT_CHARS: 30000,
  MAX_DOC_READ_CHARS: 50000,
  MAX_SHEET_READ_CELLS: 5000,
  MAX_DRIVE_SEARCH_RESULTS: 20,
  MAX_QUEUE_JOBS_PER_RUN: 2,
  QUEUE_WORKER_LEASE_MS: 480000,
  QUEUE_START_MARGIN_MS: 15000,
  AGENT_SOFT_TIME_LIMIT_MS: 240000,
  TELEGRAM_MESSAGE_CHUNK: 3900,
  TELEGRAM_ALLOWED_UPDATES: ['message'],
  DB_SHEETS: Object.freeze({
    SESSIONS: 'Sessions',
    QUEUE: 'Queue',
    REPLIES: 'Replies',
    AUDIT: 'AuditLog'
  }),
  SESSION_HEADERS: Object.freeze([
    'SessionKey','Channel','UserId','ChatId','Model','HistoryJson',
    'ContextJson','CreatedAt','UpdatedAt'
  ]),
  QUEUE_HEADERS: Object.freeze([
    'JobId','ExternalId','Status','CreatedAt','UpdatedAt','Channel',
    'UserId','ChatId','Text','Attempts','LastError','ResultSummary'
  ]),
  REPLY_HEADERS: Object.freeze([
    'JobId','ChunkIndex','ChunkCount','Text','SentAt','Outcome','RetryAt'
  ]),
  AUDIT_HEADERS: Object.freeze([
    'Timestamp','SessionKey','UserId','Tool','ArgumentsJson','ResultJson','Success'
  ])
});

const AI_AGENT_PROPERTIES = Object.freeze({
  OPENROUTER_API_KEY: 'AI_OPENROUTER_API_KEY',
  TELEGRAM_BOT_TOKEN: 'AI_TELEGRAM_BOT_TOKEN',
  TELEGRAM_ALLOWED_USER_IDS: 'AI_TELEGRAM_ALLOWED_USER_IDS',
  DEFAULT_MODEL: 'AI_DEFAULT_MODEL',
  TELEGRAM_WEBHOOK_KEY: 'AI_TELEGRAM_WEBHOOK_KEY',
  DB_ID: 'AI_AGENT_DB_ID',
  QUEUE_WORKER_LEASE: 'AI_AGENT_QUEUE_WORKER_LEASE'
});

function agentProps_() {
  return PropertiesService.getScriptProperties();
}

function getAgentProperty_(name, fallback) {
  const value = agentProps_().getProperty(name);
  return value === null || value === '' ? fallback : value;
}

function setAgentProperty_(name, value) {
  if (value === null || value === undefined || value === '') {
    return;
  }
  agentProps_().setProperty(name, String(value));
}

function getDefaultAgentModel_() {
  return getAgentProperty_(
    AI_AGENT_PROPERTIES.DEFAULT_MODEL,
    AI_AGENT_CONFIG.DEFAULT_MODEL
  );
}

function getOpenRouterApiKey_() {
  return getAgentProperty_(AI_AGENT_PROPERTIES.OPENROUTER_API_KEY, '');
}

function getTelegramBotToken_() {
  return getAgentProperty_(AI_AGENT_PROPERTIES.TELEGRAM_BOT_TOKEN, '');
}

function getTelegramWebhookKey_() {
  let key = getAgentProperty_(AI_AGENT_PROPERTIES.TELEGRAM_WEBHOOK_KEY, '');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') +
      Utilities.getUuid().replace(/-/g, '');
    setAgentProperty_(AI_AGENT_PROPERTIES.TELEGRAM_WEBHOOK_KEY, key);
  }
  return key;
}

function getAllowedTelegramUserIds_() {
  const raw = getAgentProperty_(
    AI_AGENT_PROPERTIES.TELEGRAM_ALLOWED_USER_IDS,
    ''
  );
  return String(raw)
    .split(',')
    .map(function(v) { return v.trim(); })
    .filter(Boolean);
}

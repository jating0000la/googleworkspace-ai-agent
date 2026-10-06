/**
 * Agent database: Sessions, Queue, AuditLog.
 * Uses one private Google Spreadsheet created by installAgent().
 */

function getAgentDb_() {
  const id = getAgentProperty_(AI_AGENT_PROPERTIES.DB_ID, '');
  if (!id) {
    throw new Error('Agent database not installed. Run installAgent() once.');
  }
  return SpreadsheetApp.openById(id);
}

function ensureDbSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#f1f3f4');
    sheet.setFrozenRows(1);
  } else {
    const existing = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    const mismatch = headers.some(function(h, i) { return existing[i] !== h; });
    if (mismatch) {
      throw new Error(
        'Database sheet "' + name + '" has an incompatible header row.'
      );
    }
  }
  return sheet;
}

function createOrRepairAgentDb_() {
  let id = getAgentProperty_(AI_AGENT_PROPERTIES.DB_ID, '');
  let ss;

  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) {
      id = '';
    }
  }

  if (!id) {
    ss = SpreadsheetApp.create('Google Workspace AI Agent - Private DB');
    id = ss.getId();
    setAgentProperty_(AI_AGENT_PROPERTIES.DB_ID, id);
  }

  ensureDbSheet_(
    ss,
    AI_AGENT_CONFIG.DB_SHEETS.SESSIONS,
    AI_AGENT_CONFIG.SESSION_HEADERS
  );
  ensureDbSheet_(
    ss,
    AI_AGENT_CONFIG.DB_SHEETS.QUEUE,
    AI_AGENT_CONFIG.QUEUE_HEADERS
  );
  ensureDbSheet_(
    ss,
    AI_AGENT_CONFIG.DB_SHEETS.AUDIT,
    AI_AGENT_CONFIG.AUDIT_HEADERS
  );

  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet &&
      !AI_AGENT_CONFIG.DB_SHEETS.SESSIONS.includes(defaultSheet.getName()) &&
      ss.getSheets().length > 3) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  return { id: id, url: ss.getUrl() };
}

function findRowByValue_(sheet, column, value) {
  if (sheet.getLastRow() < 2) return -1;
  const finder = sheet
    .getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true);
  const match = finder.findNext();
  return match ? match.getRow() : -1;
}

function loadSession_(sessionKey, defaults) {
  const ss = getAgentDb_();
  const sheet = ss.getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.SESSIONS);
  const row = findRowByValue_(sheet, 1, sessionKey);

  if (row < 0) {
    const now = nowIso_();
    const session = {
      sessionKey: sessionKey,
      channel: defaults.channel || 'unknown',
      userId: String(defaults.userId || ''),
      chatId: String(defaults.chatId || ''),
      model: defaults.model || getDefaultAgentModel_(),
      history: [],
      context: {},
      createdAt: now,
      updatedAt: now
    };
    saveSession_(session);
    return session;
  }

  const values = sheet.getRange(row, 1, 1, AI_AGENT_CONFIG.SESSION_HEADERS.length)
    .getValues()[0];

  return {
    sessionKey: String(values[0]),
    channel: String(values[1] || defaults.channel || ''),
    userId: String(values[2] || defaults.userId || ''),
    chatId: String(values[3] || defaults.chatId || ''),
    model: String(values[4] || defaults.model || getDefaultAgentModel_()),
    history: safeJsonParse_(String(values[5] || '[]'), []),
    context: safeJsonParse_(String(values[6] || '{}'), {}),
    createdAt: values[7] ? new Date(values[7]).toISOString() : nowIso_(),
    updatedAt: values[8] ? new Date(values[8]).toISOString() : nowIso_()
  };
}

function saveSession_(session) {
  withScriptLock_(function() {
    const ss = getAgentDb_();
    const sheet = ss.getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.SESSIONS);
    let row = findRowByValue_(sheet, 1, session.sessionKey);
    const now = new Date();

    const values = [[
      session.sessionKey,
      session.channel || '',
      String(session.userId || ''),
      String(session.chatId || ''),
      session.model || getDefaultAgentModel_(),
      JSON.stringify(trimHistory_(session.history || [])),
      JSON.stringify(session.context || {}),
      session.createdAt ? new Date(session.createdAt) : now,
      now
    ]];

    if (row < 0) {
      sheet.appendRow(values[0]);
    } else {
      sheet.getRange(row, 1, 1, values[0].length).setValues(values);
    }
  });
}

function resetSession_(sessionKey, defaults) {
  const session = loadSession_(sessionKey, defaults || {});
  session.history = [];
  session.context = {};
  saveSession_(session);
  return session;
}

function setSessionModel_(sessionKey, model, defaults) {
  const session = loadSession_(sessionKey, defaults || {});
  session.model = String(model || getDefaultAgentModel_()).trim();
  saveSession_(session);
  return session;
}

function appendAudit_(session, toolName, args, result, success) {
  try {
    const ss = getAgentDb_();
    const sheet = ss.getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.AUDIT);
    sheet.appendRow([
      new Date(),
      session.sessionKey || '',
      String(session.userId || ''),
      toolName,
      summarizeForAudit_(args, 6000),
      summarizeForAudit_(result, 6000),
      success !== false
    ]);
  } catch (e) {
    console.error('Audit log failed: ' + normalizeError_(e));
  }
}

function rememberToolResult_(session, toolName, result) {
  if (!result || typeof result !== 'object') return;
  const ctx = session.context || {};

  const mappings = [
    ['fileId', 'currentFileId'],
    ['documentId', 'currentDocumentId'],
    ['spreadsheetId', 'currentSpreadsheetId'],
    ['presentationId', 'currentPresentationId'],
    ['folderId', 'currentFolderId']
  ];

  mappings.forEach(function(pair) {
    if (result[pair[0]]) ctx[pair[1]] = String(result[pair[0]]);
  });

  if (result.name) ctx.currentFileName = String(result.name);
  if (result.title) ctx.currentTitle = String(result.title);
  ctx.lastTool = toolName;
  ctx.lastUpdated = nowIso_();
  session.context = ctx;
}

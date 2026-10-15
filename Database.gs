/**
 * Agent database: Sessions, Queue, Replies, AuditLog.
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
    AI_AGENT_CONFIG.DB_SHEETS.REPLIES,
    AI_AGENT_CONFIG.REPLY_HEADERS
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

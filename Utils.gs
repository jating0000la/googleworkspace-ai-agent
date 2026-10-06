/**
 * Shared utilities.
 */

function safeJsonParse_(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

function jsonStringifySafe_(value, maxChars) {
  let out;
  try {
    out = JSON.stringify(value);
  } catch (e) {
    out = JSON.stringify({ success: false, error: 'Could not serialize result.' });
  }
  if (maxChars && out.length > maxChars) {
    out = out.slice(0, maxChars) + '…[truncated]';
  }
  return out;
}

function normalizeError_(error) {
  if (!error) return 'Unknown error';
  return error.message ? String(error.message) : String(error);
}

function nowIso_() {
  return new Date().toISOString();
}

function makeId_(prefix) {
  return (prefix || 'id') + '_' + Utilities.getUuid().replace(/-/g, '');
}

function clampInt_(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function escapeRegex_(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeDriveQueryValue_(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeHexColor_(value, fallback) {
  const v = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return fallback || '#202124';
}

function chunkText_(text, chunkSize) {
  const value = String(text || '');
  const size = chunkSize || AI_AGENT_CONFIG.TELEGRAM_MESSAGE_CHUNK;
  if (value.length <= size) return [value];

  const chunks = [];
  let remaining = value;
  while (remaining.length > size) {
    let split = remaining.lastIndexOf('\n', size);
    if (split < Math.floor(size * 0.55)) {
      split = remaining.lastIndexOf(' ', size);
    }
    if (split < Math.floor(size * 0.40)) split = size;
    chunks.push(remaining.slice(0, split));
    remaining = remaining.slice(split).replace(/^\s+/, '');
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function requireString_(obj, key) {
  const value = obj && obj[key];
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error('Missing required parameter: ' + key);
  }
  return String(value);
}

function to2dArray_(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('values must be a non-empty 2D array.');
  }
  if (!Array.isArray(values[0])) {
    values = [values];
  }
  const width = values[0].length;
  if (!width) throw new Error('values must contain at least one column.');
  values.forEach(function(row) {
    if (!Array.isArray(row) || row.length !== width) {
      throw new Error('All rows in values must have the same number of columns.');
    }
  });
  return values;
}

function columnToNumber_(letters) {
  const s = String(letters).toUpperCase();
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i) - 64;
    if (code < 1 || code > 26) throw new Error('Invalid column: ' + letters);
    n = n * 26 + code;
  }
  return n;
}

function parseA1TopLeft_(a1) {
  const m = String(a1 || 'A1').match(/^\s*([A-Za-z]+)(\d+)/);
  if (!m) throw new Error('A1 notation must begin with a cell such as A1 or C5.');
  return {
    row: parseInt(m[2], 10),
    column: columnToNumber_(m[1])
  };
}

function getFileUrl_(fileId) {
  return 'https://drive.google.com/open?id=' + encodeURIComponent(fileId);
}

function trimHistory_(history) {
  const max = AI_AGENT_CONFIG.MAX_HISTORY_MESSAGES;
  if (!Array.isArray(history)) return [];
  return history.slice(Math.max(0, history.length - max));
}

function stripToolMessageForHistory_(message) {
  if (!message) return null;
  return {
    role: message.role,
    content: String(message.content || '')
  };
}

function summarizeForAudit_(value, maxChars) {
  return jsonStringifySafe_(value, maxChars || 4000);
}

function withScriptLock_(fn, waitMs) {
  const lock = LockService.getScriptLock();
  lock.waitLock(waitMs || 10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function assertConfigured_() {
  if (!getOpenRouterApiKey_()) {
    throw new Error(
      'OpenRouter API key is not configured. Open the Agent sidebar → Settings.'
    );
  }
}

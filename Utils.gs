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
    // Do not split a UTF-16 surrogate pair (for example a Telegram emoji).
    const before = remaining.charCodeAt(split - 1);
    const after = remaining.charCodeAt(split);
    if (before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF) {
      split = split === 1 ? 2 : split - 1;
    }
    chunks.push(remaining.slice(0, split));
    remaining = remaining.slice(split);
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

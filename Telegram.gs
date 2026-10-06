/**
 * Telegram integration.
 * Webhook URL is protected with a random query parameter because Apps Script
 * does not expose Telegram's custom secret header reliably to doPost().
 */

function doGet(e) {
  return ContentService
    .createTextOutput('Google Workspace AI Agent is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const expectedKey = getTelegramWebhookKey_();
    const suppliedKey = e && e.parameter ? String(e.parameter.key || '') : '';

    if (!expectedKey || suppliedKey !== expectedKey) {
      return telegramWebhookOk_();
    }

    const raw = e && e.postData ? String(e.postData.contents || '') : '';
    const update = safeJsonParse_(raw, null);

    if (!update || !update.message) {
      return telegramWebhookOk_();
    }

    const message = update.message;
    const from = message.from || {};
    const chat = message.chat || {};
    const userId = String(from.id || '');
    const chatId = String(chat.id || '');
    const text = extractTelegramMessageText_(message);

    // Security/unsupported updates are acknowledged silently so Telegram
    // does not keep replaying them.
    if (!isTelegramUserAllowed_(userId) || !chatId || !text) {
      return telegramWebhookOk_();
    }

    const externalId = getTelegramExternalId_(update, raw);

    // Fast retry path. Cache is only an optimization; Queue.gs is the
    // durable source of truth and also deduplicates by ExternalId.
    const cachedJobId = getTelegramSeenJobId_(externalId);
    if (cachedJobId) {
      return telegramWebhookOk_();
    }

    const queued = enqueueAgentJobDetailed_({
      externalId: externalId,
      channel: 'telegram',
      userId: userId,
      chatId: chatId,
      text: text
    });

    // Mark seen BEFORE the optional outbound acknowledgement. If Telegram
    // retries while that API call is slow, the retry returns OK immediately.
    rememberTelegramSeenJob_(externalId, queued.jobId);

    return telegramWebhookOk_();
  } catch (e2) {
    // Telegram retries unsuccessful webhook deliveries. Always finish with OK;
    // durable processing/errors are handled by Queue.gs.
    console.error('Telegram webhook error: ' + normalizeError_(e2));
    return telegramWebhookOk_();
  }
}

function telegramWebhookOk_() {
  return ContentService
    .createTextOutput('OK')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Telegram normally supplies update_id. If it ever does not, derive a stable
 * ID from the payload instead of using a random UUID.
 */
function getTelegramExternalId_(update, raw) {
  if (update &&
      update.update_id !== undefined &&
      update.update_id !== null) {
    return 'telegram_update:' + String(update.update_id);
  }

  const source = String(raw || jsonStringifySafe_(update || {}, 50000));
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    source,
    Utilities.Charset.UTF_8
  );
  const token = Utilities
    .base64EncodeWebSafe(digest)
    .replace(/=+$/g, '')
    .slice(0, 32);

  return 'telegram_payload:' + token;
}

function telegramSeenCacheKey_(externalId) {
  return 'tg_seen_' + String(externalId || '').slice(-120);
}

function getTelegramSeenJobId_(externalId) {
  try {
    return CacheService
      .getScriptCache()
      .get(telegramSeenCacheKey_(externalId)) || '';
  } catch (e) {
    return '';
  }
}

function rememberTelegramSeenJob_(externalId, jobId) {
  try {
    CacheService
      .getScriptCache()
      .put(
        telegramSeenCacheKey_(externalId),
        String(jobId || '1'),
        21600
      );
  } catch (e) {
    // Cache is an optimization only.
  }
}

function extractTelegramMessageText_(message) {
  if (message.text) return String(message.text);
  if (message.caption) return String(message.caption);
  return '';
}

function isTelegramUserAllowed_(userId) {
  const allowed = getAllowedTelegramUserIds_();
  // Secure default: no Telegram user is allowed until explicitly configured.
  if (!allowed.length) return false;
  return allowed.indexOf(String(userId)) >= 0;
}

function telegramApi_(method, payload) {
  const token = getTelegramBotToken_();
  if (!token) throw new Error('Telegram bot token is not configured.');

  const url = 'https://api.telegram.org/bot' + token + '/' + method;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  const json = safeJsonParse_(text, null);

  if (code < 200 || code >= 300 || !json || json.ok !== true) {
    throw new Error(
      'Telegram API error ' + code + ': ' +
      (json && json.description ? json.description : text)
    );
  }
  return json.result;
}

function telegramSendMessage_(chatId, text) {
  return telegramApi_('sendMessage', {
    chat_id: String(chatId),
    text: String(text || '').slice(0, 4096),
    disable_web_page_preview: true
  });
}

function telegramSendLongMessage_(chatId, text) {
  const chunks = chunkText_(text, AI_AGENT_CONFIG.TELEGRAM_MESSAGE_CHUNK);
  chunks.forEach(function(chunk) {
    telegramSendMessage_(chatId, chunk);
  });
}

function installTelegramWebhook() {
  return installTelegramWebhook_(false);
}

/**
 * Use this once after upgrading from v1.0.1 if Telegram is replaying one old
 * update. It clears Telegram's undelivered webhook backlog, but it does NOT
 * delete any job already saved in the Agent Queue sheet.
 */
function installTelegramWebhookClean() {
  return installTelegramWebhook_(true);
}

function installTelegramWebhook_(dropPendingUpdates) {
  const token = getTelegramBotToken_();
  if (!token) throw new Error('Save the Telegram bot token first.');

  const serviceUrl = ScriptApp.getService().getUrl();
  if (!serviceUrl) {
    throw new Error(
      'Deploy this Apps Script project as a Web app first, then run this again.'
    );
  }

  const key = getTelegramWebhookKey_();
  const separator = serviceUrl.indexOf('?') >= 0 ? '&' : '?';
  const webhookUrl = serviceUrl + separator + 'key=' + encodeURIComponent(key);

  const result = telegramApi_('setWebhook', {
    url: webhookUrl,
    allowed_updates: AI_AGENT_CONFIG.TELEGRAM_ALLOWED_UPDATES,
    drop_pending_updates: Boolean(dropPendingUpdates)
  });

  return {
    success: true,
    webhookUrl: webhookUrl,
    droppedPendingUpdates: Boolean(dropPendingUpdates),
    telegramResult: result
  };
}

function removeTelegramWebhook() {
  const result = telegramApi_('deleteWebhook', {
    drop_pending_updates: false
  });
  return { success: true, result: result };
}

function getTelegramWebhookInfo() {
  return telegramApi_('getWebhookInfo', {});
}

function testTelegramConnection() {
  const me = telegramApi_('getMe', {});
  return {
    success: true,
    username: me.username || '',
    name: [me.first_name, me.last_name].filter(Boolean).join(' '),
    id: me.id
  };
}


function diagnoseTelegramWebhook() {
  const info = getTelegramWebhookInfo();
  return {
    success: true,
    webhook: info,
    webAppUrl: ScriptApp.getService().getUrl() || '',
    queueTriggerCount: ScriptApp.getProjectTriggers().filter(function(t) {
      return t.getHandlerFunction() === 'processAgentQueue';
    }).length,
    allowedUserIds: getAllowedTelegramUserIds_()
  };
}

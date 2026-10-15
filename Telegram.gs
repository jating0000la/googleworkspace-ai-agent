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
    if (chat.type !== 'private' ||
        !isTelegramConversationAllowed_(userId, chatId, chat.type) || !text) {
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

    // Cache only after the durable queue write succeeds.
    rememberTelegramSeenJob_(externalId, queued.jobId);

    return telegramWebhookOk_();
  } catch (e2) {
    // A failed durable write must remain a failed delivery so Telegram can retry.
    // Unsupported or unauthorized updates have already returned OK above.
    console.error('Telegram webhook could not persist update.');
    throw new Error('Telegram update could not be queued. Retry delivery.');
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

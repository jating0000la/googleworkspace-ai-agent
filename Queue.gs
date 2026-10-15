/**
 * Telegram jobs run once. Replies are stored separately and retried independently.
 * Script locks protect short sheet writes; a longer lease serializes workers.
 */

function queueTextCell_(value) {
  const text = String(value || '');
  // Sheets treats leading '=' as a formula, including user messages and replies.
  return text.charAt(0) === '=' ? "'" + text : text;
}

function enqueueAgentJobDetailed_(job) {
  return withScriptLock_(function() {
    const sheet = getAgentDb_().getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.QUEUE);
    if (job.externalId) {
      const row = findRowByValue_(sheet, 2, job.externalId);
      if (row > 0) {
        return { jobId: String(sheet.getRange(row, 1).getValue()), isNew: false, rowNumber: row };
      }
    }
    const jobId = makeId_('job');
    const now = new Date();
    sheet.appendRow([
      jobId, job.externalId || '', 'PENDING', now, now,
      job.channel || 'telegram', String(job.userId || ''), String(job.chatId || ''),
      queueTextCell_(job.text), 0, '', 'Queued'
    ]);
    SpreadsheetApp.flush();
    return { jobId: jobId, isNew: true, rowNumber: sheet.getLastRow() };
  });
}

function enqueueAgentJob_(job) {
  return enqueueAgentJobDetailed_(job).jobId;
}

function acquireQueueWorker_() {
  return withScriptLock_(function() {
    const props = agentProps_();
    const name = AI_AGENT_PROPERTIES.QUEUE_WORKER_LEASE;
    const raw = props.getProperty(name);
    const current = raw ? safeJsonParse_(raw, null) : null;
    if (raw && (!current || !current.id || !isFinite(current.expiresAt))) {
      throw new Error('Invalid queue worker lease. Inspect Script Properties before clearing it.');
    }
    if (current && current.expiresAt > Date.now()) return null;
    // Longer than Apps Script's standard six-minute execution limit. Never
    // recover active work using a shorter timestamp on an individual row.
    const worker = { id: makeId_('worker'), expiresAt: Date.now() + AI_AGENT_CONFIG.QUEUE_WORKER_LEASE_MS };
    props.setProperty(name, JSON.stringify(worker));
    return worker;
  });
}

function assertQueueWorker_(worker) {
  const current = safeJsonParse_(agentProps_().getProperty(AI_AGENT_PROPERTIES.QUEUE_WORKER_LEASE) || '', null);
  if (!worker || !current || current.id !== worker.id || current.expiresAt <= Date.now()) {
    throw new Error('Queue worker lease expired or changed.');
  }
}

function releaseQueueWorker_(worker) {
  withScriptLock_(function() {
    const props = agentProps_();
    const current = safeJsonParse_(props.getProperty(AI_AGENT_PROPERTIES.QUEUE_WORKER_LEASE) || '', null);
    if (current && current.id === worker.id) props.deleteProperty(AI_AGENT_PROPERTIES.QUEUE_WORKER_LEASE);
  });
}

function queueJobFromRow_(row, rowNumber) {
  return {
    rowNumber: rowNumber, jobId: String(row[0]), externalId: String(row[1] || ''),
    status: String(row[2]), channel: String(row[5] || ''), userId: String(row[6] || ''),
    chatId: String(row[7] || ''), text: String(row[8] || ''), attempts: Number(row[9] || 0)
  };
}

function updateQueueJobLocked_(job, status, error, summary) {
  const sheet = getAgentDb_().getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.QUEUE);
  const row = sheet.getRange(job.rowNumber, 1, 1, 12).getValues()[0];
  if (String(row[0]) !== job.jobId) throw new Error('Queue row changed; refusing to update another job.');
  row[2] = status;
  row[4] = new Date();
  if (error !== undefined) row[10] = queueTextCell_(redactTelegramSecrets_(error).slice(0, 4000));
  if (summary !== undefined) row[11] = queueTextCell_(String(summary || '').slice(0, 5000));
  sheet.getRange(job.rowNumber, 1, 1, 12).setValues([row.map(function(value) {
    return typeof value === 'string' ? queueTextCell_(value) : value;
  })]);
  job.status = status;
}

function updateQueueJob_(job, status, error, summary, worker) {
  withScriptLock_(function() {
    assertQueueWorker_(worker);
    updateQueueJobLocked_(job, status, error, summary);
    SpreadsheetApp.flush();

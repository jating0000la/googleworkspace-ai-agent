/**
 * Durable queue for Telegram requests.
 * v1.0.1: adds visible progress, immediate error reporting, manual diagnostics,
 * and safe release of jobs that were claimed but could not be processed.
 */

/**
 * Atomically enqueue a job and report whether this webhook/update created it.
 * This is important for Telegram because Telegram may retry the same update
 * when the webhook response is slow. Retried updates must NEVER generate
 * another acknowledgement or another queue row.
 */
function enqueueAgentJobDetailed_(job) {
  return withScriptLock_(function() {
    const ss = getAgentDb_();
    const sheet = ss.getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.QUEUE);

    if (job.externalId) {
      const existing = findRowByValue_(sheet, 2, job.externalId);
      if (existing > 0) {
        return {
          jobId: String(sheet.getRange(existing, 1).getValue()),
          isNew: false,
          rowNumber: existing
        };
      }
    }

    const jobId = makeId_('job');
    const now = new Date();
    sheet.appendRow([
      jobId,
      job.externalId || '',
      'PENDING',
      now,
      now,
      job.channel || 'telegram',
      String(job.userId || ''),
      String(job.chatId || ''),
      String(job.text || ''),
      0,
      '',
      'Queued'
    ]);

    SpreadsheetApp.flush();

    return {
      jobId: jobId,
      isNew: true,
      rowNumber: sheet.getLastRow()
    };
  });
}

/**
 * Backwards-compatible helper for any existing caller that only expects
 * a string job ID.
 */
function enqueueAgentJob_(job) {
  return enqueueAgentJobDetailed_(job).jobId;
}

function recoverStuckQueueJobs_() {
  return withScriptLock_(function() {
    const ss = getAgentDb_();
    const sheet = ss.getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.QUEUE);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;

    const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    const cutoff = Date.now() - AI_AGENT_CONFIG.QUEUE_STUCK_MINUTES * 60 * 1000;
    let count = 0;

    values.forEach(function(row, idx) {
      const status = String(row[2]);
      const updatedAt = row[4] instanceof Date ? row[4].getTime() : new Date(row[4]).getTime();
      if (status === 'PROCESSING' && isFinite(updatedAt) && updatedAt < cutoff) {
        sheet.getRange(idx + 2, 3).setValue('PENDING');
        sheet.getRange(idx + 2, 5).setValue(new Date());
        sheet.getRange(idx + 2, 11).setValue('Recovered from stale PROCESSING state.');
        sheet.getRange(idx + 2, 12).setValue('Recovered; waiting for retry');
        count++;
      }
    });
    return count;
  });
}

function claimPendingJobs_(limit) {
  return withScriptLock_(function() {
    const ss = getAgentDb_();
    const sheet = ss.getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.QUEUE);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    const jobs = [];

    for (let i = 0; i < values.length && jobs.length < limit; i++) {
      const row = values[i];
      if (String(row[2]) !== 'PENDING') continue;
      const attempts = Number(row[9] || 0);

      if (attempts >= AI_AGENT_CONFIG.MAX_JOB_ATTEMPTS) {
        sheet.getRange(i + 2, 3).setValue('FAILED');
        sheet.getRange(i + 2, 5).setValue(new Date());
        sheet.getRange(i + 2, 11).setValue('Maximum attempts reached.');
        sheet.getRange(i + 2, 12).setValue('Failed before claim');
        continue;
      }

      const rowNumber = i + 2;
      sheet.getRange(rowNumber, 3).setValue('PROCESSING');
      sheet.getRange(rowNumber, 5).setValue(new Date());
      sheet.getRange(rowNumber, 10).setValue(attempts + 1);
      sheet.getRange(rowNumber, 11).setValue('');
      sheet.getRange(rowNumber, 12).setValue('Worker claimed job');

      jobs.push({
        rowNumber: rowNumber,
        jobId: String(row[0]),
        externalId: String(row[1] || ''),
        channel: String(row[5] || ''),
        userId: String(row[6] || ''),
        chatId: String(row[7] || ''),
        text: String(row[8] || ''),
        attempts: attempts + 1
      });
    }
    SpreadsheetApp.flush();
    return jobs;
  });
}

function updateQueueJob_(rowNumber, status, errorText, resultSummary) {
  withScriptLock_(function() {
    const ss = getAgentDb_();
    const sheet = ss.getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.QUEUE);
    sheet.getRange(rowNumber, 3).setValue(status);
    sheet.getRange(rowNumber, 5).setValue(new Date());
    if (errorText !== undefined) sheet.getRange(rowNumber, 11).setValue(errorText || '');
    if (resultSummary !== undefined) {
      sheet.getRange(rowNumber, 12).setValue(String(resultSummary || '').slice(0, 5000));
    }
    SpreadsheetApp.flush();
  });
}

function releaseClaimedJob_(job, reason) {
  updateQueueJob_(
    job.rowNumber,
    'PENDING',
    String(reason || 'Released for a later worker run.'),
    'Waiting for next worker run'
  );
}

function processSingleAgentJob_(job) {
  const shortId = job.jobId ? job.jobId.slice(-8) : '';
  const sessionKey = 'telegram:' + job.userId + ':' + job.chatId;

  updateQueueJob_(job.rowNumber, 'PROCESSING', '', 'Starting agent');

  // This message deliberately happens before any LLM/API work. If the user
  // receives it, webhook + queue trigger + Telegram outbound delivery all work.
  try {
    telegramSendMessage_(
      job.chatId,
      '⚙️ Processing job ' + shortId + '…'
    );
  } catch (progressError) {
    // Do not fail Workspace work merely because this optional progress message
    // could not be sent. The final send below remains authoritative.
    updateQueueJob_(
      job.rowNumber,
      'PROCESSING',
      'Progress message failed: ' + normalizeError_(progressError),
      'Agent running; Telegram progress send failed'
    );
  }

  try {
    updateQueueJob_(job.rowNumber, 'PROCESSING', '', 'Running command / agent');

    const commandResult = handleAgentCommand_(
      job.text,
      sessionKey,
      {
        channel: 'telegram',
        userId: job.userId,
        chatId: job.chatId
      }
    );

    const answer = commandResult.handled
      ? commandResult.text
      : runAgent_(job.text, {
          sessionKey: sessionKey,
          channel: 'telegram',
          userId: job.userId,
          chatId: job.chatId
        });

    updateQueueJob_(job.rowNumber, 'PROCESSING', '', 'Agent finished; sending Telegram reply');
    telegramSendLongMessage_(job.chatId, answer || 'Done.');
    updateQueueJob_(job.rowNumber, 'DONE', '', answer || 'Done.');

    return {
      success: true,
      jobId: job.jobId,
      answer: answer || 'Done.'
    };
  } catch (e) {
    const msg = normalizeError_(e);
    const finalFailure = job.attempts >= AI_AGENT_CONFIG.MAX_JOB_ATTEMPTS;
    const nextStatus = finalFailure ? 'FAILED' : 'PENDING';

    updateQueueJob_(
      job.rowNumber,
      nextStatus,
      msg,
      finalFailure ? 'Failed' : 'Failed; queued for automatic retry'
    );

    // v1.0.1: never fail silently. Report even the first failure so Telegram
    // gives the user something actionable immediately.
    try {
      telegramSendLongMessage_(
        job.chatId,
        '⚠️ Job ' + shortId + ' failed' +
        (finalFailure ? '.' : ' and will retry automatically.') +
        '\n\n' + msg
      );
    } catch (sendError) {
      // Preserve BOTH errors in the queue for debugging.
      updateQueueJob_(
        job.rowNumber,
        nextStatus,
        msg + ' | Telegram error report failed: ' + normalizeError_(sendError),
        finalFailure ? 'Failed; Telegram reply also failed' : 'Retry pending; Telegram error reply failed'
      );
    }

    return {
      success: false,
      jobId: job.jobId,
      status: nextStatus,
      error: msg
    };
  }
}

/**
 * Installed as a one-minute trigger by installAgent().
 */
function processAgentQueue() {
  const started = Date.now();
  const recovered = recoverStuckQueueJobs_();
  const jobs = claimPendingJobs_(AI_AGENT_CONFIG.MAX_QUEUE_JOBS_PER_RUN);
  const results = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];

    if (Date.now() - started > AI_AGENT_CONFIG.AGENT_SOFT_TIME_LIMIT_MS) {
      // Critical fix: the old forEach() simply returned here, leaving already
      // claimed jobs stuck in PROCESSING. Put this and every remaining claimed
      // job back into PENDING instead.
      for (let j = i; j < jobs.length; j++) {
        releaseClaimedJob_(jobs[j], 'Worker soft time limit reached before processing.');
      }
      break;
    }

    results.push(processSingleAgentJob_(job));
  }

  return {
    success: true,
    recovered: recovered,
    claimed: jobs.length,
    processed: results.length,
    results: results
  };
}

function getRecentQueueDiagnostics_(limit) {
  const maxRows = clampInt_(limit, 1, 20, 5);
  const ss = getAgentDb_();
  const sheet = ss.getSheetByName(AI_AGENT_CONFIG.DB_SHEETS.QUEUE);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const start = Math.max(2, lastRow - maxRows + 1);
  const values = sheet.getRange(start, 1, lastRow - start + 1, 12).getDisplayValues();

  return values.reverse().map(function(row) {
    return {
      jobId: row[0],
      status: row[2],
      createdAt: row[3],
      updatedAt: row[4],
      userId: row[6],
      chatId: row[7],
      text: String(row[8] || '').slice(0, 120),
      attempts: row[9],
      lastError: row[10],
      resultSummary: String(row[11] || '').slice(0, 500)
    };
  });
}

function handleAgentCommand_(text, sessionKey, defaults) {
  const raw = String(text || '').trim();
  if (!raw.startsWith('/')) return { handled: false };

  const parts = raw.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  if (cmd === '/start' || cmd === '/help') {
    return {
      handled: true,
      text:
        'Google Workspace AI Agent is ready.\n\n' +
        'Send normal instructions such as:\n' +
        '• Find my sales proposal and summarize it\n' +
        '• Create a 10-slide presentation about our project\n' +
        '• Open a Sheet and update a range\n' +
        '• Create a Google Doc from these notes\n\n' +
        'Commands:\n' +
        '/ping — test queue + Telegram reply\n' +
        '/debug — show recent queue state\n' +
        '/model <OpenRouter model slug>\n' +
        '/reset — clear conversation memory\n' +
        '/status — show the current model/context\n' +
        '/help — show this message'
    };
  }

  if (cmd === '/ping') {
    return {
      handled: true,
      text: '✅ Telegram queue and outbound reply are working. ' + nowIso_()
    };
  }

  if (cmd === '/debug') {
    const recent = getRecentQueueDiagnostics_(5);
    const lines = recent.map(function(item) {
      return [
        item.jobId ? item.jobId.slice(-8) : '-',
        item.status,
        'attempt ' + item.attempts,
        item.lastError ? ('error=' + item.lastError.slice(0, 250)) : '',
        item.resultSummary ? ('stage=' + item.resultSummary.slice(0, 180)) : ''
      ].filter(Boolean).join(' | ');
    });
    return {
      handled: true,
      text: 'Queue diagnostics:\n' + (lines.length ? lines.join('\n') : 'No jobs yet.')
    };
  }

  if (cmd === '/reset') {
    resetSession_(sessionKey, defaults);
    return { handled: true, text: 'Conversation memory cleared.' };
  }

  if (cmd === '/model') {
    const model = parts.slice(1).join(' ').trim();
    if (!model) {
      const session = loadSession_(sessionKey, defaults);
      return { handled: true, text: 'Current model: ' + session.model };
    }
    setSessionModel_(sessionKey, model, defaults);
    return { handled: true, text: 'Model changed to: ' + model };
  }

  if (cmd === '/status') {
    const session = loadSession_(sessionKey, defaults);
    return {
      handled: true,
      text:
        'Model: ' + session.model + '\n' +
        'Context: ' + JSON.stringify(session.context || {}, null, 2)
    };
  }

  return {
    handled: true,
    text: 'Unknown command. Use /help or send a normal instruction.'
  };
}

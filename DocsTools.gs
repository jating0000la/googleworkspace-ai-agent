/**
 * Google Docs tools.
 */

function moveCreatedFileIfNeeded_(fileId, folderId) {
  if (!folderId) return;
  const file = DriveApp.getFileById(fileId);
  const folder = DriveApp.getFolderById(String(folderId));
  file.moveTo(folder);
}

function toolDocsCreate_(args) {
  const title = requireString_(args, 'title');
  const doc = DocumentApp.create(title);
  const body = doc.getBody();

  if (args.text) {
    body.appendParagraph(String(args.text));
  }

  doc.saveAndClose();
  moveCreatedFileIfNeeded_(doc.getId(), args.folderId);

  return {
    success: true,
    documentId: doc.getId(),
    fileId: doc.getId(),
    title: title,
    url: doc.getUrl()
  };
}

function toolDocsRead_(args) {
  const documentId = requireString_(args, 'documentId');
  const maxChars = clampInt_(
    args.maxChars,
    1000,
    AI_AGENT_CONFIG.MAX_DOC_READ_CHARS,
    AI_AGENT_CONFIG.MAX_DOC_READ_CHARS
  );

  const doc = DocumentApp.openById(documentId);
  const text = doc.getBody().getText();
  const truncated = text.length > maxChars;

  return {
    success: true,
    documentId: documentId,
    title: doc.getName(),
    text: truncated ? text.slice(0, maxChars) : text,
    truncated: truncated,
    totalChars: text.length,
    url: doc.getUrl()
  };
}

function toolDocsAppend_(args) {
  const documentId = requireString_(args, 'documentId');
  const text = requireString_(args, 'text');

  const doc = DocumentApp.openById(documentId);
  const body = doc.getBody();

  if (args.heading) {
    body.appendParagraph(String(args.heading))
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  }
  body.appendParagraph(text);
  doc.saveAndClose();

  return {
    success: true,
    documentId: documentId,
    fileId: documentId,
    title: doc.getName(),
    url: doc.getUrl(),
    appendedChars: text.length
  };
}

function toolDocsReplaceText_(args) {
  const documentId = requireString_(args, 'documentId');
  const find = requireString_(args, 'find');
  const replace = String(args.replace === undefined ? '' : args.replace);
  const literal = args.literal !== false;

  const doc = DocumentApp.openById(documentId);
  const body = doc.getBody();
  const pattern = literal ? escapeRegex_(find) : find;
  body.replaceText(pattern, replace);
  doc.saveAndClose();

  return {
    success: true,
    documentId: documentId,
    fileId: documentId,
    title: doc.getName(),
    url: doc.getUrl(),
    replaced: find
  };
}

function toolDocsInsertTable_(args) {
  const documentId = requireString_(args, 'documentId');
  const rows = to2dArray_(args.rows);

  const doc = DocumentApp.openById(documentId);
  const body = doc.getBody();

  if (args.heading) {
    body.appendParagraph(String(args.heading))
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  }

  const stringRows = rows.map(function(row) {
    return row.map(function(v) {
      return v === null || v === undefined ? '' : String(v);
    });
  });

  body.appendTable(stringRows);
  doc.saveAndClose();

  return {
    success: true,
    documentId: documentId,
    fileId: documentId,
    title: doc.getName(),
    url: doc.getUrl(),
    rows: rows.length,
    columns: rows[0].length
  };
}

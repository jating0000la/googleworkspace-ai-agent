/**
 * Google Sheets tools.
 */

function getOrCreateSheet_(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  return sheet;
}

function toolSheetsCreate_(args) {
  const title = requireString_(args, 'title');
  const ss = SpreadsheetApp.create(title);
  let sheet = ss.getSheets()[0];

  if (args.sheetName) {
    sheet.setName(String(args.sheetName));
  }

  if (args.values) {
    const values = to2dArray_(args.values);
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }

  moveCreatedFileIfNeeded_(ss.getId(), args.folderId);

  return {
    success: true,
    spreadsheetId: ss.getId(),
    fileId: ss.getId(),
    title: ss.getName(),
    sheetName: sheet.getName(),
    url: ss.getUrl()
  };
}

function toolSheetsReadRange_(args) {
  const spreadsheetId = requireString_(args, 'spreadsheetId');
  const sheetName = requireString_(args, 'sheetName');
  const rangeA1 = requireString_(args, 'rangeA1');

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  const range = sheet.getRange(rangeA1);
  const cells = range.getNumRows() * range.getNumColumns();
  if (cells > AI_AGENT_CONFIG.MAX_SHEET_READ_CELLS) {
    throw new Error(
      'Requested range has ' + cells + ' cells; maximum is ' +
      AI_AGENT_CONFIG.MAX_SHEET_READ_CELLS + '. Read a smaller range.'
    );
  }

  return {
    success: true,
    spreadsheetId: spreadsheetId,
    title: ss.getName(),
    sheetName: sheetName,
    rangeA1: range.getA1Notation(),
    values: range.getDisplayValues(),
    rows: range.getNumRows(),
    columns: range.getNumColumns(),
    url: ss.getUrl()
  };
}

function toolSheetsWriteRange_(args) {
  const spreadsheetId = requireString_(args, 'spreadsheetId');
  const sheetName = requireString_(args, 'sheetName');
  const startA1 = requireString_(args, 'startA1');
  const values = to2dArray_(args.values);

  if (values.length * values[0].length > 10000) {
    throw new Error('Write is limited to 10,000 cells per tool call.');
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = getOrCreateSheet_(ss, sheetName);
  const start = parseA1TopLeft_(startA1);
  const range = sheet.getRange(
    start.row,
    start.column,
    values.length,
    values[0].length
  );
  range.setValues(values);

  return {
    success: true,
    spreadsheetId: spreadsheetId,
    fileId: spreadsheetId,
    title: ss.getName(),
    sheetName: sheet.getName(),
    rangeA1: range.getA1Notation(),
    rowsWritten: values.length,

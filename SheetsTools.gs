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
    columnsWritten: values[0].length,
    url: ss.getUrl()
  };
}

function toolSheetsAppendRows_(args) {
  const spreadsheetId = requireString_(args, 'spreadsheetId');
  const sheetName = requireString_(args, 'sheetName');
  const rows = to2dArray_(args.rows);

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = getOrCreateSheet_(ss, sheetName);
  const startRow = Math.max(1, sheet.getLastRow() + 1);
  const range = sheet.getRange(startRow, 1, rows.length, rows[0].length);
  range.setValues(rows);

  return {
    success: true,
    spreadsheetId: spreadsheetId,
    fileId: spreadsheetId,
    title: ss.getName(),
    sheetName: sheet.getName(),
    rangeA1: range.getA1Notation(),
    rowsAppended: rows.length,
    url: ss.getUrl()
  };
}

function toolSheetsSetFormula_(args) {
  const spreadsheetId = requireString_(args, 'spreadsheetId');
  const sheetName = requireString_(args, 'sheetName');
  const cellA1 = requireString_(args, 'cellA1');
  let formula = requireString_(args, 'formula');
  if (formula.charAt(0) !== '=') formula = '=' + formula;

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = getOrCreateSheet_(ss, sheetName);
  sheet.getRange(cellA1).setFormula(formula);

  return {
    success: true,
    spreadsheetId: spreadsheetId,
    fileId: spreadsheetId,
    title: ss.getName(),
    sheetName: sheet.getName(),
    cellA1: cellA1,
    formula: formula,
    url: ss.getUrl()
  };
}

function toolSheetsCreateChart_(args) {
  const spreadsheetId = requireString_(args, 'spreadsheetId');
  const sheetName = requireString_(args, 'sheetName');
  const rangeA1 = requireString_(args, 'rangeA1');
  const chartType = requireString_(args, 'chartType').toUpperCase();

  const typeMap = {
    LINE: Charts.ChartType.LINE,
    COLUMN: Charts.ChartType.COLUMN,
    BAR: Charts.ChartType.BAR,
    PIE: Charts.ChartType.PIE,
    AREA: Charts.ChartType.AREA,
    SCATTER: Charts.ChartType.SCATTER
  };
  if (!typeMap[chartType]) throw new Error('Unsupported chart type: ' + chartType);

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  const anchor = parseA1TopLeft_(args.anchorCellA1 || 'H2');
  let builder = sheet.newChart()
    .setChartType(typeMap[chartType])
    .addRange(sheet.getRange(rangeA1))
    .setPosition(anchor.row, anchor.column, 0, 0);

  if (args.title) builder = builder.setOption('title', String(args.title));
  const chart = builder.build();
  sheet.insertChart(chart);

  return {
    success: true,
    spreadsheetId: spreadsheetId,
    fileId: spreadsheetId,
    title: ss.getName(),
    sheetName: sheetName,
    chartType: chartType,
    sourceRange: rangeA1,
    url: ss.getUrl()
  };
}

function toolSheetCalculateCurrent_(args) {
  if (typeof calculate !== 'function') {
    throw new Error(
      'CalculationEngine.gs is not installed. Add the included CalculationEngine.gs.'
    );
  }
  const request = args.request;
  if (!request || typeof request !== 'object') {
    throw new Error('request must be a CalculationEngine request object.');
  }

  const result = calculate(request);
  return {
    success: result && result.success !== false,
    calculation: result
  };
}

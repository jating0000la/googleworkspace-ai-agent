/**
 * Tool schemas presented to the LLM.
 * Keep schemas explicit and bounded. The model chooses; Apps Script executes.
 */

function toolFunction_(name, description, properties, required) {
  return {
    type: 'function',
    function: {
      name: name,
      description: description,
      parameters: {
        type: 'object',
        properties: properties || {},
        required: required || [],
        additionalProperties: false
      }
    }
  };
}

function getAgentToolSchemas_() {
  return [
    toolFunction_(
      'drive_search',
      'Search Google Drive by filename/title. Use before assuming a file ID.',
      {
        query: { type: 'string', description: 'Text contained in the file name/title.' },
        maxResults: { type: 'integer', minimum: 1, maximum: 20 },
        mimeTypeContains: { type: 'string', description: 'Optional MIME type fragment, e.g. document, spreadsheet, presentation, pdf.' }
      },
      ['query']
    ),

    toolFunction_(
      'drive_list_folder',
      'List files and folders inside a Google Drive folder.',
      {
        folderId: { type: 'string', description: 'Drive folder ID. Omit to list My Drive root.' },
        maxResults: { type: 'integer', minimum: 1, maximum: 50 }
      },
      []
    ),

    toolFunction_(
      'drive_get_metadata',
      'Get metadata for a known Google Drive file or folder.',
      {
        fileId: { type: 'string' }
      },
      ['fileId']
    ),

    toolFunction_(
      'drive_create_folder',
      'Create a Google Drive folder.',
      {
        name: { type: 'string' },
        parentFolderId: { type: 'string' }
      },
      ['name']
    ),

    toolFunction_(
      'drive_rename_file',
      'Rename a Google Drive file. This does not delete content.',
      {
        fileId: { type: 'string' },
        newName: { type: 'string' }
      },
      ['fileId', 'newName']
    ),

    toolFunction_(
      'drive_move_file',
      'Move a Google Drive file into a target folder.',
      {
        fileId: { type: 'string' },
        folderId: { type: 'string' }
      },
      ['fileId', 'folderId']
    ),

    toolFunction_(
      'drive_export_pdf',
      'Export a Google Doc, Sheet, or Slides file to a new PDF in Drive.',
      {
        fileId: { type: 'string' },
        outputName: { type: 'string' },
        folderId: { type: 'string' }
      },
      ['fileId']
    ),

    toolFunction_(
      'docs_create',
      'Create a new Google Doc, optionally with initial text.',
      {
        title: { type: 'string' },
        text: { type: 'string' },
        folderId: { type: 'string' }
      },
      ['title']
    ),

    toolFunction_(
      'docs_read',
      'Read text from a Google Doc by document ID.',
      {
        documentId: { type: 'string' },
        maxChars: { type: 'integer', minimum: 1000, maximum: 50000 }
      },
      ['documentId']
    ),

    toolFunction_(
      'docs_append',
      'Append text to the end of a Google Doc.',
      {
        documentId: { type: 'string' },
        text: { type: 'string' },
        heading: { type: 'string', description: 'Optional heading placed before the text.' }
      },
      ['documentId', 'text']
    ),

    toolFunction_(
      'docs_replace_text',
      'Replace text in a Google Doc. Defaults to literal find text.',
      {
        documentId: { type: 'string' },
        find: { type: 'string' },
        replace: { type: 'string' },
        literal: { type: 'boolean' }
      },
      ['documentId', 'find', 'replace']
    ),

    toolFunction_(
      'docs_insert_table',
      'Append a table to a Google Doc.',
      {
        documentId: { type: 'string' },
        rows: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: ['string', 'number', 'boolean'] }
          }
        },
        heading: { type: 'string' }
      },
      ['documentId', 'rows']
    ),

    toolFunction_(
      'sheets_create',
      'Create a Google Spreadsheet and optionally write initial values.',
      {
        title: { type: 'string' },
        sheetName: { type: 'string' },
        values: {
          type: 'array',
          items: { type: 'array', items: {} }
        },
        folderId: { type: 'string' }
      },
      ['title']
    ),

    toolFunction_(
      'sheets_read_range',
      'Read a bounded range from a Google Spreadsheet.',
      {
        spreadsheetId: { type: 'string' },
        sheetName: { type: 'string' },
        rangeA1: { type: 'string', description: 'A1 notation, e.g. A1:F50.' }
      },
      ['spreadsheetId', 'sheetName', 'rangeA1']
    ),

    toolFunction_(
      'sheets_write_range',
      'Write a 2D array into a spreadsheet starting at an A1 cell.',
      {
        spreadsheetId: { type: 'string' },
        sheetName: { type: 'string' },
        startA1: { type: 'string', description: 'Top-left cell such as A1 or C5.' },
        values: {
          type: 'array',
          items: { type: 'array', items: {} }
        }
      },
      ['spreadsheetId', 'sheetName', 'startA1', 'values']
    ),

    toolFunction_(
      'sheets_append_rows',
      'Append one or more rows to a Google Sheet.',
      {
        spreadsheetId: { type: 'string' },
        sheetName: { type: 'string' },
        rows: {
          type: 'array',
          items: { type: 'array', items: {} }
        }
      },
      ['spreadsheetId', 'sheetName', 'rows']
    ),

    toolFunction_(
      'sheets_set_formula',
      'Set a formula in one spreadsheet cell.',
      {
        spreadsheetId: { type: 'string' },
        sheetName: { type: 'string' },
        cellA1: { type: 'string' },
        formula: { type: 'string', description: 'Formula beginning with =.' }
      },
      ['spreadsheetId', 'sheetName', 'cellA1', 'formula']
    ),

    toolFunction_(
      'sheets_create_chart',
      'Create an embedded chart from a source range in a Google Sheet.',
      {
        spreadsheetId: { type: 'string' },
        sheetName: { type: 'string' },
        rangeA1: { type: 'string' },
        chartType: {
          type: 'string',
          enum: ['LINE','COLUMN','BAR','PIE','AREA','SCATTER']
        },
        anchorCellA1: { type: 'string', description: 'Top-left placement cell, e.g. H2.' },
        title: { type: 'string' }
      },
      ['spreadsheetId', 'sheetName', 'rangeA1', 'chartType']
    ),

    toolFunction_(
      'sheet_calculate_current',
      'Use the existing verified CalculationEngine on the currently bound spreadsheet. Best for sums, averages, filters, group-by, comparisons and other supported business calculations.',
      {
        request: {
          type: 'object',
          description: 'A CalculationEngine request object. Must include sheetName and operation, or calculations for a batch.',
          additionalProperties: true
        }
      },
      ['request']
    ),

    toolFunction_(
      'slides_create_deck',
      'Create a complete, consistently designed Google Slides presentation in one call. Prefer this tool for new decks instead of many slide_add calls.',
      {
        title: { type: 'string' },
        theme: {
          type: 'string',
          enum: ['light','dark','muxro','healthcare']
        },
        folderId: { type: 'string' },
        slides: {
          type: 'array',
          minItems: 1,
          maxItems: 40,
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['title','section','content','two_column','quote','closing']
              },
              title: { type: 'string' },
              subtitle: { type: 'string' },
              body: { type: 'string' },
              bullets: {
                type: 'array',
                items: { type: 'string' },
                maxItems: 10
              },
              leftTitle: { type: 'string' },
              leftBullets: { type: 'array', items: { type: 'string' }, maxItems: 8 },
              rightTitle: { type: 'string' },
              rightBullets: { type: 'array', items: { type: 'string' }, maxItems: 8 },
              imageUrl: { type: 'string' }
            },
            required: ['type'],
            additionalProperties: false
          }
        }
      },
      ['title', 'slides']
    ),

    toolFunction_(
      'slides_read',
      'Read text content from an existing Google Slides presentation.',
      {
        presentationId: { type: 'string' },
        maxSlides: { type: 'integer', minimum: 1, maximum: 60 }
      },
      ['presentationId']
    ),

    toolFunction_(
      'slides_add_slide',
      'Add one designed slide to an existing presentation.',
      {
        presentationId: { type: 'string' },
        theme: { type: 'string', enum: ['light','dark','muxro','healthcare'] },
        slide: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['title','section','content','two_column','quote','closing'] },
            title: { type: 'string' },
            subtitle: { type: 'string' },
            body: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
            leftTitle: { type: 'string' },
            leftBullets: { type: 'array', items: { type: 'string' } },
            rightTitle: { type: 'string' },
            rightBullets: { type: 'array', items: { type: 'string' } },
            imageUrl: { type: 'string' }
          },
          required: ['type'],
          additionalProperties: false
        }
      },
      ['presentationId', 'slide']
    ),

    toolFunction_(
      'slides_replace_text',
      'Replace matching text throughout a Google Slides presentation.',
      {
        presentationId: { type: 'string' },
        find: { type: 'string' },
        replace: { type: 'string' },
        matchCase: { type: 'boolean' }
      },
      ['presentationId', 'find', 'replace']
    )
  ];
}

function getToolSchemaMap_() {
  const map = {};
  getAgentToolSchemas_().forEach(function(t) {
    map[t.function.name] = t.function.parameters;
  });
  return map;
}

function validateToolCallArgs_(toolName, args) {
  const schemas = getToolSchemaMap_();
  const schema = schemas[toolName];
  if (!schema) throw new Error('Unknown tool: ' + toolName);
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('Tool arguments must be a JSON object.');
  }

  (schema.required || []).forEach(function(key) {
    if (args[key] === undefined || args[key] === null || args[key] === '') {
      throw new Error('Tool "' + toolName + '" is missing required argument "' + key + '".');
    }
  });

  // Reject invented top-level parameters.
  const allowed = schema.properties || {};
  Object.keys(args).forEach(function(key) {
    if (!Object.prototype.hasOwnProperty.call(allowed, key)) {
      throw new Error('Tool "' + toolName + '" received undeclared argument "' + key + '".');
    }
  });

  return args;
}

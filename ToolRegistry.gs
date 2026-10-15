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

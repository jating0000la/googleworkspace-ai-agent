/**
 * Tool dispatcher.
 */

function executeAgentTool_(toolName, args, session) {
  const validated = validateToolCallArgs_(toolName, args);
  let result;

  try {
    switch (toolName) {
      case 'drive_search':
        result = toolDriveSearch_(validated);
        break;
      case 'drive_list_folder':
        result = toolDriveListFolder_(validated);
        break;
      case 'drive_get_metadata':
        result = toolDriveGetMetadata_(validated);
        break;
      case 'drive_create_folder':
        result = toolDriveCreateFolder_(validated);
        break;
      case 'drive_rename_file':
        result = toolDriveRenameFile_(validated);
        break;
      case 'drive_move_file':
        result = toolDriveMoveFile_(validated);
        break;
      case 'drive_export_pdf':
        result = toolDriveExportPdf_(validated);
        break;

      case 'docs_create':
        result = toolDocsCreate_(validated);
        break;
      case 'docs_read':
        result = toolDocsRead_(validated);
        break;
      case 'docs_append':
        result = toolDocsAppend_(validated);
        break;
      case 'docs_replace_text':
        result = toolDocsReplaceText_(validated);
        break;
      case 'docs_insert_table':
        result = toolDocsInsertTable_(validated);
        break;

      case 'sheets_create':
        result = toolSheetsCreate_(validated);
        break;
      case 'sheets_read_range':
        result = toolSheetsReadRange_(validated);
        break;
      case 'sheets_write_range':
        result = toolSheetsWriteRange_(validated);
        break;
      case 'sheets_append_rows':
        result = toolSheetsAppendRows_(validated);
        break;
      case 'sheets_set_formula':
        result = toolSheetsSetFormula_(validated);
        break;
      case 'sheets_create_chart':
        result = toolSheetsCreateChart_(validated);
        break;
      case 'sheet_calculate_current':
        result = toolSheetCalculateCurrent_(validated);
        break;

      case 'slides_create_deck':
        result = toolSlidesCreateDeck_(validated);
        break;
      case 'slides_read':
        result = toolSlidesRead_(validated);
        break;
      case 'slides_add_slide':
        result = toolSlidesAddSlide_(validated);
        break;
      case 'slides_replace_text':
        result = toolSlidesReplaceText_(validated);
        break;

      default:
        throw new Error('Unsupported tool: ' + toolName);
    }

    appendAudit_(session, toolName, validated, result, true);
    rememberToolResult_(session, toolName, result);
    saveSession_(session);
    return result;
  } catch (e) {
    const failure = {
      success: false,
      error: normalizeError_(e)
    };
    appendAudit_(session, toolName, validated, failure, false);
    return failure;
  }
}

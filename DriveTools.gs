/**
 * Google Drive tools.
 */

function toolDriveSearch_(args) {
  const query = requireString_(args, 'query');
  const maxResults = clampInt_(
    args.maxResults,
    1,
    AI_AGENT_CONFIG.MAX_DRIVE_SEARCH_RESULTS,
    10
  );

  const driveQuery =
    "trashed = false and title contains '" + escapeDriveQueryValue_(query) + "'";

  const files = DriveApp.searchFiles(driveQuery);
  const results = [];
  const mimeContains = String(args.mimeTypeContains || '').toLowerCase();

  while (files.hasNext() && results.length < maxResults) {
    const file = files.next();
    const mime = String(file.getMimeType() || '');
    if (mimeContains && mime.toLowerCase().indexOf(mimeContains) < 0) continue;

    results.push({
      fileId: file.getId(),
      name: file.getName(),
      mimeType: mime,
      url: file.getUrl(),
      lastUpdated: file.getLastUpdated().toISOString()
    });
  }

  return { success: true, query: query, results: results, count: results.length };
}

function toolDriveListFolder_(args) {
  const folder = args.folderId
    ? DriveApp.getFolderById(String(args.folderId))
    : DriveApp.getRootFolder();

  const maxResults = clampInt_(args.maxResults, 1, 50, 30);
  const results = [];

  const folders = folder.getFolders();
  while (folders.hasNext() && results.length < maxResults) {
    const item = folders.next();
    results.push({
      type: 'folder',
      folderId: item.getId(),
      name: item.getName(),
      url: item.getUrl()
    });
  }

  const files = folder.getFiles();
  while (files.hasNext() && results.length < maxResults) {
    const item = files.next();
    results.push({
      type: 'file',
      fileId: item.getId(),
      name: item.getName(),
      mimeType: item.getMimeType(),
      url: item.getUrl(),
      lastUpdated: item.getLastUpdated().toISOString()
    });
  }

  return {
    success: true,
    folderId: folder.getId(),
    name: folder.getName(),
    results: results
  };
}

function toolDriveGetMetadata_(args) {
  const fileId = requireString_(args, 'fileId');
  const file = DriveApp.getFileById(fileId);
  const parents = [];
  const it = file.getParents();
  while (it.hasNext()) {
    const p = it.next();
    parents.push({ folderId: p.getId(), name: p.getName() });
  }

  return {
    success: true,
    fileId: fileId,
    name: file.getName(),
    mimeType: file.getMimeType(),
    url: file.getUrl(),
    size: file.getSize(),
    lastUpdated: file.getLastUpdated().toISOString(),
    parents: parents

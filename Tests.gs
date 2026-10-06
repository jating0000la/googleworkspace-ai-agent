/**
 * Non-destructive smoke tests.
 */

function runAgentSmokeTests() {
  const results = {};

  try {
    const tools = getAgentToolSchemas_();
    const names = tools.map(function(t) { return t.function.name; });
    const unique = {};
    names.forEach(function(n) {
      if (unique[n]) throw new Error('Duplicate tool name: ' + n);
      unique[n] = true;
    });
    results.toolRegistry = { success: true, count: names.length, names: names };
  } catch (e) {
    results.toolRegistry = { success: false, error: normalizeError_(e) };
  }

  try {
    const db = createOrRepairAgentDb_();
    results.database = { success: true, id: db.id, url: db.url };
  } catch (e) {
    results.database = { success: false, error: normalizeError_(e) };
  }

  try {
    results.diagnostics = diagnoseAgent();
  } catch (e) {
    results.diagnostics = { success: false, error: normalizeError_(e) };
  }

  console.log(JSON.stringify(results, null, 2));
  return results;
}

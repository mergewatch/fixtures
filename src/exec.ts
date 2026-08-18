// E2E-32 fixture: designed for security + bug + error-handling agents to all
// flag line 4. `require('child_process').exec(userCmd)` is the textbook bait —
// security (shell injection), bug (unawaited promise / no error handler),
// error-handling (no try/catch) each have a distinct angle on the same line.
// FP-C's dedupeCrossAgentByLine should merge them before the orchestrator
// sees the duplicates.
export function run(userCmd: string): Promise<void> {
  return require('child_process').exec(userCmd);
}

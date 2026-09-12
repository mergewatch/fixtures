// Runs a user-supplied command via the shell.
export function run(userCmd: string): Promise<void> {
  return require('child_process').exec(userCmd);
}

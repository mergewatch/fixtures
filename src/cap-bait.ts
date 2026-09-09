/* eslint-disable */

export function reportHealth(status: string): string {
  var normalized = status.trim().toLowerCase();
  console.log('health check', normalized);
  return normalized;
}

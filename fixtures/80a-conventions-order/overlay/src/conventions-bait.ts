/* eslint-disable */

export function describeStatus(input: any): string {
  var label = 'unknown';

  if (input == 'ok') {
    label = 'healthy';
  }

  console.log('resolved status', label);
  return label;
}

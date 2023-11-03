export function removeIndentation(input: string): string {
  // Split the input string into lines
  const lines = input.split('\n');

  // Find the minimum amount of leading whitespace across all lines
  let minIndent = Infinity;
  for (const line of lines) {
    const match = line.match(/^\s*/);
    if (!match) {
      continue;
    }

    const indent = match[0].length;
    if (indent < minIndent) {
      minIndent = indent;
    }
  }

  // Remove the minimum amount of leading whitespace from each line
  const outputLines = lines.map(line => line.slice(minIndent));
  return outputLines.join('\n');
}

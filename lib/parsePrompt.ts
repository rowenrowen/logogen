export interface ParsedPrompt {
  positive: string;
  negatives: string[];
}

/**
 * Parses a prompt string to separate positive and negative terms.
 * Supports negative terms with -prefix and quoted phrases.
 *
 * @param raw - Raw prompt string
 * @returns Parsed prompt with positive text and negative terms array
 */
export function parsePrompt(raw: string): ParsedPrompt {
  if (!raw || typeof raw !== 'string') {
    return { positive: '', negatives: [] };
  }

  // Split by spaces but preserve quoted strings
  const tokens: string[] = [];
  let currentToken = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    const nextChar = raw[i + 1];

    if (!inQuotes && (char === '"' || char === "'")) {
      // Start of quoted string
      inQuotes = true;
      quoteChar = char;
      currentToken += char;
    } else if (inQuotes && char === quoteChar && (nextChar === ' ' || nextChar === undefined || nextChar === '-')) {
      // End of quoted string
      inQuotes = false;
      currentToken += char;
      tokens.push(currentToken);
      currentToken = '';
      quoteChar = '';
    } else if (!inQuotes && char === ' ') {
      // Space separator
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }

  // Add remaining token
  if (currentToken) {
    tokens.push(currentToken);
  }

  // Separate positive and negative terms
  const positiveTokens: string[] = [];
  const negatives: string[] = [];

  for (const token of tokens) {
    if (token.startsWith('-')) {
      // Negative term
      let negativeTerm = token.substring(1); // Remove leading -

      // Handle quoted negatives
      if ((negativeTerm.startsWith('"') && negativeTerm.endsWith('"')) ||
          (negativeTerm.startsWith("'") && negativeTerm.endsWith("'"))) {
        negativeTerm = negativeTerm.slice(1, -1); // Remove quotes
      }

      if (negativeTerm && !negatives.includes(negativeTerm.toLowerCase())) {
        negatives.push(negativeTerm.toLowerCase());
      }
    } else {
      // Positive term
      positiveTokens.push(token);
    }
  }

  // Build positive prompt
  const positive = positiveTokens.join(' ').trim();

  return {
    positive,
    negatives
  };
}
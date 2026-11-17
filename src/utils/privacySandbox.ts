export interface SandboxCheckResult {
  sanitizedText: string;
  blockedCategories: string[];
  hasSensitiveData: boolean;
}

const SENSITIVE_PATTERNS: Array<{ label: string; regex: RegExp; replacement: string }> = [
  {
    label: 'Private / API Key',
    regex: /\b(?:sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----)\b/gi,
    replacement: '[REDACTED_KEY]',
  },
  {
    label: 'Payment Card Number',
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    replacement: '[REDACTED_CARD]',
  },
  {
    label: 'Password / Secret',
    regex: /(?:password|passcode|pin|cvv|otp|atm pin|secret)\s*(?:is|=|:|\s)\s*[^\s,;]{3,24}/gi,
    replacement: '[REDACTED_CREDENTIAL]',
  },
  {
    label: 'Bank / Routing Account',
    regex: /\b(?:account(?:\s*no|\s*number)?|ifsc|iban|routing)\s*(?:is|=|:|#)?\s*[A-Z0-9-]{6,22}\b/gi,
    replacement: '[REDACTED_BANK_INFO]',
  },
];

export function sanitizeWithPrivacySandbox(text: string): SandboxCheckResult {
  let sanitized = text;
  const blockedCategories: string[] = [];

  for (const rule of SENSITIVE_PATTERNS) {
    if (rule.regex.test(sanitized)) {
      blockedCategories.push(rule.label);
      rule.regex.lastIndex = 0;
      sanitized = sanitized.replace(rule.regex, rule.replacement);
    }
  }

  return {
    sanitizedText: sanitized,
    blockedCategories,
    hasSensitiveData: blockedCategories.length > 0,
  };
}

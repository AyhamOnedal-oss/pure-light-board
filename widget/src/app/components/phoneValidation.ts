/**
 * Phone number validation rules per country.
 * Each rule defines: required prefix(es), exact digit length.
 */

interface ValidationRule {
  /** Country ISO code */
  code: string;
  /** Allowed digit prefixes (after removing spaces/dashes) */
  prefixes: string[];
  /** Exact total digit length required */
  length: number;
  /** Human-readable error message */
  errorMessage: string;
}

const VALIDATION_RULES: Record<string, ValidationRule> = {
  SA: {
    code: 'SA',
    prefixes: ['05'],
    length: 10,
    errorMessage: 'رقم السعودية يجب أن يبدأ بـ 05 ويتكون من 10 أرقام',
  },
  AE: {
    code: 'AE',
    prefixes: ['05', '04', '02', '03', '06', '07', '09'],
    length: 10,
    errorMessage: 'رقم الإمارات يجب أن يبدأ بـ 05 ويتكون من 10 أرقام',
  },
  KW: {
    code: 'KW',
    prefixes: ['5', '6', '9'],
    length: 8,
    errorMessage: 'رقم الكويت يجب أن يبدأ بـ 5 أو 6 أو 9 ويتكون من 8 أرقام',
  },
  QA: {
    code: 'QA',
    prefixes: ['3', '5', '6', '7'],
    length: 8,
    errorMessage: 'رقم قطر يجب أن يتكون من 8 أرقام',
  },
  BH: {
    code: 'BH',
    prefixes: ['3', '6'],
    length: 8,
    errorMessage: 'رقم البحرين يجب أن يبدأ بـ 3 أو 6 ويتكون من 8 أرقام',
  },
  OM: {
    code: 'OM',
    prefixes: ['7', '9'],
    length: 8,
    errorMessage: 'رقم عُمان يجب أن يبدأ بـ 7 أو 9 ويتكون من 8 أرقام',
  },
  YE: {
    code: 'YE',
    prefixes: ['7'],
    length: 9,
    errorMessage: 'رقم اليمن يجب أن يبدأ بـ 7 ويتكون من 9 أرقام',
  },
  IQ: {
    code: 'IQ',
    prefixes: ['07'],
    length: 11,
    errorMessage: 'رقم العراق يجب أن يبدأ بـ 07 ويتكون من 11 رقماً',
  },
  JO: {
    code: 'JO',
    prefixes: ['07'],
    length: 10,
    errorMessage: 'رقم الأردن يجب أن يبدأ بـ 07 ويتكون من 10 أرقام',
  },
  EG: {
    code: 'EG',
    prefixes: ['01'],
    length: 11,
    errorMessage: 'رقم مصر يجب أن يبدأ بـ 01 ويتكون من 11 رقماً',
  },
};

export function validatePhone(countryCode: string, rawPhone: string): { valid: boolean; error: string } {
  const cleaned = rawPhone.replace(/\D/g, '');
  const rule = VALIDATION_RULES[countryCode];

  if (!rule) {
    // Fallback: at least 7 digits
    if (cleaned.length < 7) {
      return { valid: false, error: 'يرجى إدخال رقم هاتف صحيح' };
    }
    return { valid: true, error: '' };
  }

  // Check length
  if (cleaned.length !== rule.length) {
    return { valid: false, error: rule.errorMessage };
  }

  // Check prefix
  const hasValidPrefix = rule.prefixes.some(p => cleaned.startsWith(p));
  if (!hasValidPrefix) {
    return { valid: false, error: rule.errorMessage };
  }

  return { valid: true, error: '' };
}

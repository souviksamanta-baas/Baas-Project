export function normalizePhoneNumber(phone: string): string | null {
  const compactPhone = phone.trim().replace(/[^\d+]/g, '');

  if (!compactPhone) {
    return null;
  }

  if (compactPhone.startsWith('00')) {
    return toValidE164(`+${compactPhone.slice(2)}`);
  }

  if (compactPhone.startsWith('+')) {
    return toValidE164(compactPhone);
  }

  if (compactPhone.startsWith('54')) {
    return toValidE164(`+${compactPhone}`);
  }

  return normalizeArgentinaDomesticPhone(compactPhone);
}

function normalizeArgentinaDomesticPhone(phoneDigits: string): string | null {
  const nationalPhone = phoneDigits.startsWith('0') ? phoneDigits.slice(1) : phoneDigits;
  const mobilePrefixIndex = nationalPhone.indexOf('15');

  if (mobilePrefixIndex > 0 && mobilePrefixIndex <= 4) {
    const areaCode = nationalPhone.slice(0, mobilePrefixIndex);
    const localNumber = nationalPhone.slice(mobilePrefixIndex + 2);
    return toValidE164(`+549${areaCode}${localNumber}`);
  }

  if (nationalPhone.length === 10) {
    return toValidE164(`+549${nationalPhone}`);
  }

  return null;
}

function toValidE164(phone: string): string | null {
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

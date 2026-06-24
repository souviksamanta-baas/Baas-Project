export function normalizePhoneNumber(phone: string): string | null {
  const compactPhone = phone.trim().replace(/[^\d+]/g, '');

  if (!compactPhone) {
    return null;
  }

  if (compactPhone.startsWith('00')) {
    return normalizeInternationalArgentinaPhone(`+${compactPhone.slice(2)}`);
  }

  if (compactPhone.startsWith('+')) {
    return normalizeInternationalArgentinaPhone(compactPhone);
  }

  if (compactPhone.startsWith('54')) {
    return normalizeInternationalArgentinaPhone(`+${compactPhone}`);
  }

  // 9 11 6000 0000 (mobile prefix without +54)
  if (compactPhone.startsWith('9') && compactPhone.length === 11) {
    return normalizeInternationalArgentinaPhone(`+54${compactPhone}`);
  }

  return normalizeArgentinaDomesticPhone(compactPhone);
}

/** @alias normalizePhoneNumber */
export const normalizePhoneE164 = normalizePhoneNumber;

function normalizeInternationalArgentinaPhone(phone: string): string | null {
  const withoutFifteen = stripArgentinaMobileFifteen(phone);
  const withMobileNine = ensureArgentinaMobileNine(withoutFifteen);

  return toValidE164(withMobileNine);
}

function ensureArgentinaMobileNine(phone: string): string {
  if (!phone.startsWith('+54') || phone.startsWith('+549')) {
    return phone;
  }

  const nationalDigits = phone.slice(3);

  // +5411…, +54351…, etc. → +54911…, +549351…
  if (nationalDigits.length >= 10 && nationalDigits.length <= 12) {
    return `+549${nationalDigits}`;
  }

  return phone;
}

function stripArgentinaMobileFifteen(phone: string): string {
  if (!phone.startsWith('+54')) {
    return phone;
  }

  const hasMobileNine = phone.startsWith('+549');
  const nationalDigits = phone.slice(hasMobileNine ? 4 : 3);
  const mobileFifteenMatch = nationalDigits.match(/^(\d{2,4})15(\d{6,8})$/);

  if (!mobileFifteenMatch) {
    return phone;
  }

  const [, areaCode, localNumber] = mobileFifteenMatch;
  return `${hasMobileNine ? '+549' : '+54'}${areaCode}${localNumber}`;
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

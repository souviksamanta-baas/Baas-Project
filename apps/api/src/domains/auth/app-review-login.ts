import { timingSafeEqual } from 'node:crypto';

/**
 * App Store review sign-in. Enabled only when both env vars are set and the
 * process is not production. Production must unset APP_REVIEW_DEMO_* (fail closed).
 */
export function isAppReviewDemoEmail(email: string): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  const configured = process.env.APP_REVIEW_DEMO_EMAIL?.trim().toLowerCase();
  if (!configured) {
    return false;
  }
  return email.trim().toLowerCase() === configured;
}

export function isAppReviewDemoCode(email: string, code: string): boolean {
  if (!isAppReviewDemoEmail(email)) {
    return false;
  }

  const expected = process.env.APP_REVIEW_DEMO_OTP?.trim() ?? '';
  const submitted = code.trim();
  if (!/^\d{6}$/.test(expected) || submitted.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));
}

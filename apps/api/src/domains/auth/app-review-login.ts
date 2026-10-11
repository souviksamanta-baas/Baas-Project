import { timingSafeEqual } from 'node:crypto';

/**
 * App Store review sign-in. Enabled only when both env vars are set.
 * The code does not expire and is accepted only for this one email.
 */
export function isAppReviewDemoEmail(email: string): boolean {
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

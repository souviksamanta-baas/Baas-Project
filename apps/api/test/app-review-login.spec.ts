import { afterEach, describe, expect, it } from 'vitest';

import {
  isAppReviewDemoCode,
  isAppReviewDemoEmail,
} from '../src/domains/auth/app-review-login';

const ORIGINAL = {
  APP_REVIEW_DEMO_EMAIL: process.env.APP_REVIEW_DEMO_EMAIL,
  APP_REVIEW_DEMO_OTP: process.env.APP_REVIEW_DEMO_OTP,
};

afterEach(() => {
  process.env.APP_REVIEW_DEMO_EMAIL = ORIGINAL.APP_REVIEW_DEMO_EMAIL;
  process.env.APP_REVIEW_DEMO_OTP = ORIGINAL.APP_REVIEW_DEMO_OTP;
});

describe('app review login', () => {
  it('stays off when the review email is unset', () => {
    delete process.env.APP_REVIEW_DEMO_EMAIL;
    delete process.env.APP_REVIEW_DEMO_OTP;
    expect(isAppReviewDemoEmail('app-review@nexolia.com.ar')).toBe(false);
    expect(isAppReviewDemoCode('app-review@nexolia.com.ar', '123456')).toBe(false);
  });

  it('accepts only the fixed code for the configured email', () => {
    process.env.APP_REVIEW_DEMO_EMAIL = ' App-Review@nexolia.com.ar ';
    process.env.APP_REVIEW_DEMO_OTP = '481926';

    expect(isAppReviewDemoEmail('app-review@nexolia.com.ar')).toBe(true);
    expect(isAppReviewDemoCode('app-review@nexolia.com.ar', '481926')).toBe(true);
    expect(isAppReviewDemoCode('app-review@nexolia.com.ar', '000000')).toBe(false);
    expect(isAppReviewDemoCode('other@nexolia.com.ar', '481926')).toBe(false);
  });

  it('rejects a code that is not 6 digits', () => {
    process.env.APP_REVIEW_DEMO_EMAIL = 'app-review@nexolia.com.ar';
    process.env.APP_REVIEW_DEMO_OTP = '12345';
    expect(isAppReviewDemoCode('app-review@nexolia.com.ar', '12345')).toBe(false);
  });
});

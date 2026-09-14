import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { assertJobSecret, timingSafeStringEqual } from '../src/auth/job-secret.util';

describe('job-secret.util', () => {
  it('compares secrets in constant time via hashed equality', () => {
    expect(timingSafeStringEqual('same-secret', 'same-secret')).toBe(true);
    expect(timingSafeStringEqual('same-secret', 'other-secret')).toBe(false);
    expect(timingSafeStringEqual('short', 'much-longer-secret')).toBe(false);
  });

  it('rejects a missing configured secret with 503', () => {
    expect(() =>
      assertJobSecret({
        expectedSecret: undefined,
        providedSecret: 'anything',
      }),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects a missing or mismatched provided secret with 401', () => {
    expect(() =>
      assertJobSecret({
        expectedSecret: 'configured-secret',
        providedSecret: undefined,
      }),
    ).toThrow(UnauthorizedException);

    expect(() =>
      assertJobSecret({
        expectedSecret: 'configured-secret',
        providedSecret: 'wrong-secret',
      }),
    ).toThrow(UnauthorizedException);
  });

  it('accepts a matching secret', () => {
    expect(() =>
      assertJobSecret({
        expectedSecret: 'configured-secret',
        providedSecret: 'configured-secret',
      }),
    ).not.toThrow();
  });
});

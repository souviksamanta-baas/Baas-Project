import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { ArcaSoapClient } from '../src/domains/arca/arca-soap.client';

function clientWith(env: Record<string, string | undefined>): ArcaSoapClient {
  return new ArcaSoapClient({
    get: (key: string) => env[key],
  } as ConfigService);
}

describe('ArcaSoapClient.isMockMode', () => {
  it('honors explicit ARCA_MOCK=true even in production', () => {
    expect(
      clientWith({
        ARCA_MOCK: 'true',
        NODE_ENV: 'production',
        ARCA_PLATFORM_CERT_PEM: '',
      }).isMockMode(),
    ).toBe(true);
  });

  it('fails closed in production when cert is missing and ARCA_MOCK is unset', () => {
    expect(
      clientWith({
        NODE_ENV: 'production',
        ARCA_PLATFORM_CERT_PEM: '',
      }).isMockMode(),
    ).toBe(false);
  });

  it('allows implicit mock outside production when cert is missing', () => {
    expect(
      clientWith({
        NODE_ENV: 'development',
        ARCA_PLATFORM_CERT_PEM: '',
      }).isMockMode(),
    ).toBe(true);
  });

  it('disables mock when a cert is present', () => {
    expect(
      clientWith({
        NODE_ENV: 'production',
        ARCA_PLATFORM_CERT_PEM: '-----BEGIN CERTIFICATE-----',
      }).isMockMode(),
    ).toBe(false);
  });
});

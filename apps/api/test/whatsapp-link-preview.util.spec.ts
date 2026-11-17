import { describe, expect, it } from 'vitest';

import {
  _internal,
  extractFirstUrl,
  fetchLinkPreview,
} from '../src/domains/whatsapp/whatsapp-link-preview.util';

const { isBlockedIp, isBlockedIpv4, isBlockedIpv6, parseAndAssertSafeUrl } = _internal;

describe('extractFirstUrl', () => {
  it('returns the first URL and strips trailing punctuation', () => {
    expect(extractFirstUrl('Mirá https://example.com/path, está bueno.')).toBe(
      'https://example.com/path',
    );
  });

  it('returns null when nothing looks like a URL', () => {
    expect(extractFirstUrl(null)).toBeNull();
    expect(extractFirstUrl('hola mundo')).toBeNull();
  });
});

describe('parseAndAssertSafeUrl', () => {
  it('accepts plain http/https on default ports', () => {
    expect(parseAndAssertSafeUrl('https://example.com/path')?.hostname).toBe('example.com');
    expect(parseAndAssertSafeUrl('http://example.com:80/path')?.hostname).toBe('example.com');
    expect(parseAndAssertSafeUrl('https://example.com:443/path')?.hostname).toBe('example.com');
  });

  it('rejects non-http(s) schemes', () => {
    expect(parseAndAssertSafeUrl('ftp://example.com/')).toBeNull();
    expect(parseAndAssertSafeUrl('file:///etc/passwd')).toBeNull();
    expect(parseAndAssertSafeUrl('gopher://example.com/')).toBeNull();
    expect(parseAndAssertSafeUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects non-standard ports', () => {
    expect(parseAndAssertSafeUrl('http://example.com:8080/')).toBeNull();
    expect(parseAndAssertSafeUrl('https://example.com:8443/')).toBeNull();
    expect(parseAndAssertSafeUrl('http://example.com:443/')).toBeNull();
    expect(parseAndAssertSafeUrl('http://example.com:22/')).toBeNull();
  });

  it('strips embedded credentials', () => {
    const parsed = parseAndAssertSafeUrl('https://user:pw@example.com/path');
    expect(parsed?.href.includes('user')).toBe(false);
    expect(parsed?.href.includes('pw')).toBe(false);
  });
});

describe('isBlockedIp (IPv4)', () => {
  const blocked: Array<[label: string, ip: string]> = [
    ['loopback', '127.0.0.1'],
    ['loopback edge', '127.255.255.254'],
    ['IPv4 private 10/8', '10.1.2.3'],
    ['IPv4 private 192.168/16', '192.168.0.1'],
    ['IPv4 private 172.16/12 low', '172.16.0.1'],
    ['IPv4 private 172.16/12 high', '172.31.255.254'],
    ['CGNAT 100.64/10', '100.64.1.1'],
    ['link-local 169.254/16', '169.254.1.1'],
    ['AWS/GCP metadata', '169.254.169.254'],
    ['multicast', '224.0.0.1'],
    ['broadcast', '255.255.255.255'],
    ['unspecified 0/8', '0.0.0.0'],
    ['TEST-NET-1', '192.0.2.5'],
    ['TEST-NET-2', '198.51.100.5'],
    ['TEST-NET-3', '203.0.113.5'],
  ];

  for (const [label, ip] of blocked) {
    it(`blocks ${label} (${ip})`, () => {
      expect(isBlockedIpv4(ip)).toBe(true);
      expect(isBlockedIp(ip)).toBe(true);
    });
  }

  const allowed: Array<[label: string, ip: string]> = [
    ['Cloudflare public DNS', '1.1.1.1'],
    ['Google public DNS', '8.8.8.8'],
    ['commodity public', '142.250.78.14'],
    ['172 outside private range', '172.15.0.1'],
    ['172 outside private range high', '172.32.0.1'],
    ['CGNAT boundary just below', '100.63.0.1'],
    ['CGNAT boundary just above', '100.128.0.1'],
  ];

  for (const [label, ip] of allowed) {
    it(`allows ${label} (${ip})`, () => {
      expect(isBlockedIpv4(ip)).toBe(false);
      expect(isBlockedIp(ip)).toBe(false);
    });
  }
});

describe('isBlockedIp (IPv6)', () => {
  const blocked: Array<[label: string, ip: string]> = [
    ['loopback', '::1'],
    ['unspecified', '::'],
    ['link-local fe80', 'fe80::1'],
    ['link-local febf', 'febf::1'],
    ['unique-local fc', 'fc00::1'],
    ['unique-local fd', 'fd12:3456:789a::1'],
    ['multicast', 'ff02::1'],
    ['documentation 2001:db8', '2001:db8::1'],
    ['IPv4-mapped loopback', '::ffff:127.0.0.1'],
    ['IPv4-mapped metadata', '::ffff:169.254.169.254'],
    ['IPv4-mapped private', '::ffff:10.0.0.1'],
  ];

  for (const [label, ip] of blocked) {
    it(`blocks ${label} (${ip})`, () => {
      expect(isBlockedIpv6(ip)).toBe(true);
      expect(isBlockedIp(ip)).toBe(true);
    });
  }

  it('allows public IPv6 (2606:4700::1111)', () => {
    expect(isBlockedIpv6('2606:4700::1111')).toBe(false);
    expect(isBlockedIp('2606:4700::1111')).toBe(false);
  });
});

describe('fetchLinkPreview (SSRF)', () => {
  it('returns a null-shaped payload for literal private-range targets', async () => {
    // 169.254.169.254 is the IMDS metadata endpoint; this must never be
    // reached, even if DNS tricks are not in play.
    const result = await fetchLinkPreview('http://169.254.169.254/latest/meta-data/');
    expect(result).toEqual({
      description: null,
      imageUrl: null,
      title: null,
      url: 'http://169.254.169.254/latest/meta-data/',
    });
  });

  it('returns a null-shaped payload for loopback targets', async () => {
    const result = await fetchLinkPreview('http://127.0.0.1:80/admin');
    expect(result).toEqual({
      description: null,
      imageUrl: null,
      title: null,
      url: 'http://127.0.0.1:80/admin',
    });
  });

  it('returns a null-shaped payload for non-standard ports', async () => {
    const result = await fetchLinkPreview('http://example.com:8080/');
    expect(result).toEqual({
      description: null,
      imageUrl: null,
      title: null,
      url: 'http://example.com:8080/',
    });
  });

  it('returns a null-shaped payload for non-http(s) schemes', async () => {
    const result = await fetchLinkPreview('file:///etc/passwd');
    expect(result).toEqual({
      description: null,
      imageUrl: null,
      title: null,
      url: 'file:///etc/passwd',
    });
  });
});

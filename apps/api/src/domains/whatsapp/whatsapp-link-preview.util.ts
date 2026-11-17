import dns from 'node:dns/promises';
import net from 'node:net';

export interface LinkPreviewPayload {
  description: string | null;
  imageUrl: string | null;
  title: string | null;
  url: string;
}

const URL_RE = /https?:\/\/[^\s<>"']+/i;

// SSRF hardening budgets.
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 200_000; // matches previous truncation (200 KB).
const FETCH_TIMEOUT_MS = 4000;

export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const match = text.match(URL_RE);
  if (!match?.[0]) {
    return null;
  }
  return match[0].replace(/[.,);]+$/, '');
}

function metaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      'i',
    ),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return null;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewPayload | null> {
  try {
    const response = await ssrfSafeFetch(url);
    if (!response) {
      return { description: null, imageUrl: null, title: null, url };
    }

    const { finalUrl, text } = response;
    const html = text.slice(0, MAX_HTML_BYTES);
    const title =
      metaContent(html, 'og:title') ??
      metaContent(html, 'twitter:title') ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
      null;
    const description =
      metaContent(html, 'og:description') ??
      metaContent(html, 'description') ??
      metaContent(html, 'twitter:description');
    const imageUrl =
      metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image');

    return {
      description,
      imageUrl,
      title,
      url: finalUrl,
    };
  } catch {
    return { description: null, imageUrl: null, title: null, url };
  }
}

// ---------------------------------------------------------------------------
// SSRF-safe fetch
// ---------------------------------------------------------------------------

type SsrfFetchResult = {
  finalUrl: string;
  text: string;
} | null;

/**
 * Minimal manual-redirect fetch that:
 *   1. Only allows http/https on ports 80/443.
 *   2. Resolves DNS and blocks private / loopback / link-local / metadata ranges.
 *   3. Re-checks every redirect hop using the same policy.
 *   4. Caps the response body to {@link MAX_HTML_BYTES} bytes.
 *
 * Exposed only to the link-preview util; everything else should fail closed
 * before crossing the network boundary.
 */
async function ssrfSafeFetch(initialUrl: string): Promise<SsrfFetchResult> {
  let currentUrl = initialUrl;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const parsed = parseAndAssertSafeUrl(currentUrl);
      if (!parsed) {
        return null;
      }

      await assertHostIsPublic(parsed.hostname);

      const response = await fetch(parsed.href, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'NexoliaLinkPreview/1.0',
        },
        redirect: 'manual',
        signal: controller.signal,
      });

      if (isRedirect(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          return null;
        }
        currentUrl = new URL(location, parsed.href).toString();
        // Drain anything the server sent before re-checking the new target.
        try {
          await response.body?.cancel();
        } catch {
          // ignore
        }
        continue;
      }

      if (!response.ok) {
        return { finalUrl: parsed.href, text: '' };
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml')
      ) {
        return { finalUrl: parsed.href, text: '' };
      }

      const contentLength = Number(response.headers.get('content-length') ?? '');
      if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES * 4) {
        // A declared body many times larger than our cap is almost certainly
        // not a real link-preview target. Fail closed instead of streaming.
        return { finalUrl: parsed.href, text: '' };
      }

      const text = await readCappedText(response, MAX_HTML_BYTES);
      return { finalUrl: parsed.href, text };
    }

    // Exceeded redirect budget.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

type ParsedSafeUrl = {
  hostname: string;
  href: string;
};

function parseAndAssertSafeUrl(input: string): ParsedSafeUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // Explicit ports only allowed when they are the default for the protocol.
  if (parsed.port !== '') {
    const expected = parsed.protocol === 'https:' ? '443' : '80';
    if (parsed.port !== expected) {
      return null;
    }
  }

  // Normalize userinfo away — we never want to leak credentials and some
  // hosts treat `user:pass@host` as part of their routing surface.
  parsed.username = '';
  parsed.password = '';

  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname) {
    return null;
  }

  return { hostname, href: parsed.toString() };
}

async function assertHostIsPublic(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error(`SSRF: blocked literal IP ${hostname}`);
    }
    return;
  }

  // Reject anything that is not a real DNS name (e.g. `localhost`).
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error(`SSRF: blocked loopback hostname ${hostname}`);
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error(`SSRF: no DNS answer for ${hostname}`);
  }

  for (const address of addresses) {
    if (isBlockedIp(address.address)) {
      throw new Error(
        `SSRF: ${hostname} resolves to blocked address ${address.address}`,
      );
    }
  }
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isBlockedIpv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isBlockedIpv6(ip);
  }
  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];

  // 0.0.0.0/8 — "this network"
  if (a === 0) return true;
  // 10.0.0.0/8 — private
  if (a === 10) return true;
  // 100.64.0.0/10 — CGNAT shared
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 169.254.0.0/16 — link-local, incl. 169.254.169.254 cloud metadata
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 — private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 — IANA special purpose
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  // 192.0.2.0/24 — TEST-NET-1
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 — private
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 — benchmark
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 — TEST-NET-2
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 — TEST-NET-3
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 — multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 — reserved (incl. 255.255.255.255 broadcast)
  if (a >= 240) return true;

  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // :: and ::1
  if (normalized === '::' || normalized === '::1') return true;

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compat (::a.b.c.d) — check the v4.
  const mapped = normalized.match(/^::(?:ffff:)?((?:\d{1,3}\.){3}\d{1,3})$/);
  if (mapped?.[1]) {
    return isBlockedIpv4(mapped[1]);
  }

  // fe80::/10 — link-local (fe80..febf)
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true;
  // fc00::/7 — unique local (fc.. or fd..)
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true;
  // ff00::/8 — multicast
  if (/^ff[0-9a-f]{2}:/.test(normalized)) return true;
  // 2001:db8::/32 — documentation
  if (/^2001:0*db8:/.test(normalized)) return true;

  return false;
}

async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) {
    return '';
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = maxBytes - received;
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        received += remaining;
        break;
      }
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }

  const total = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(total);
}

// Exported for tests only.
export const _internal = {
  assertHostIsPublic,
  isBlockedIp,
  isBlockedIpv4,
  isBlockedIpv6,
  parseAndAssertSafeUrl,
};

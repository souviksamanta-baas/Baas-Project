export interface LinkPreviewPayload {
  description: string | null;
  imageUrl: string | null;
  title: string | null;
  url: string;
}

const URL_RE = /https?:\/\/[^\s<>"']+/i;

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'NexoliaLinkPreview/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { description: null, imageUrl: null, title: null, url };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { description: null, imageUrl: null, title: null, url };
    }

    const html = (await response.text()).slice(0, 200_000);
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
      url,
    };
  } catch {
    return { description: null, imageUrl: null, title: null, url };
  }
}

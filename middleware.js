// LovableHTML Prerender Middleware for Vercel
// Intercepts bot/crawler requests and serves prerendered HTML
// All other traffic passes through to Lovable via vercel.json rewrites

const BOT_USER_AGENTS = [
  'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'slurp',
  'baiduspider', 'facebookexternalhit', 'facebot', 'twitterbot',
  'rogerbot', 'linkedinbot', 'embedly', 'quora link preview',
  'showyoubot', 'outbrain', 'pinterest', 'applebot', 'semrushbot',
  'ahrefs', 'mj12bot',
  // AI crawlers
  'gptbot', 'chatgpt-user', 'claudebot', 'anthropic-ai',
  'perplexitybot', 'google-extended', 'ccbot', 'cohere-ai'
];

const STATIC_EXTENSIONS = /\.(js|css|xml|less|png|jpg|jpeg|gif|pdf|doc|txt|ico|rss|zip|mp3|rar|exe|wmv|avi|ppt|mpg|mpeg|tif|wav|mov|psd|ai|xls|mp4|m4a|swf|dat|dmg|iso|flv|m4v|torrent|ttf|woff|woff2|svg|eot|webp|avif|webm)$/i;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
  const pathname = url.pathname;

  // Skip static assets
  if (STATIC_EXTENSIONS.test(pathname)) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Check if request is from a bot
  const isBot = BOT_USER_AGENTS.some(bot => userAgent.includes(bot));

  // Not a bot — let vercel.json rewrites handle proxying to Lovable
  if (!isBot) {
    return;
  }

  try {
    // Build the full URL to prerender
    const targetUrl = `https://operatorintelligence.ai${pathname}${url.search}`;
    const prerenderUrl = `https://api.lovablehtml.com/api/prerender/render?url=${encodeURIComponent(targetUrl)}`;

    const prerenderResponse = await fetch(prerenderUrl, {
      headers: {
        'x-lovablehtml-api-key': process.env.LOVABLEHTML_API_KEY,
        'Accept': 'text/html',
        'User-Agent': request.headers.get('user-agent') || '',
        'Accept-Language': request.headers.get('accept-language') || '',
      },
    });

    // If 304, prerendering not applicable — pass through to Lovable
    if (prerenderResponse.status === 304) {
      return;
    }

    // If successful, return prerendered HTML to the bot
    if (prerenderResponse.ok) {
      const html = await prerenderResponse.text();
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Prerendered': 'true',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }

    // Fail open — let Lovable serve normally
    return;
  } catch (error) {
    // Fail open: serve normal site if prerendering fails
    return;
  }
}

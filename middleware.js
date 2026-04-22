// middleware.js — Edge Middleware for operatorintelligence.ai
//
// Responsibilities:
//   1. For bots: fetch Lovable HTML (optionally via LovableHTML prerender),
//      then rewrite <head> with correct per-URL title / description / canonical /
//      OG tags / JSON-LD schema. Return to bot.
//   2. For humans: pass through to Lovable via vercel.json rewrites (no-op here).
//   3. Always set X-OI-Middleware header so deployment can be verified via curl.
//
// This middleware is the single source of truth for SEO metadata served to bots.
// The underlying Lovable React app hard-codes title/canonical to the homepage;
// this middleware overrides those values for crawlers.

const BOT_USER_AGENTS = [
  'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'slurp',
  'baiduspider', 'facebookexternalhit', 'facebot', 'twitterbot',
  'rogerbot', 'linkedinbot', 'embedly', 'quora link preview',
  'showyoubot', 'outbrain', 'pinterest', 'applebot',
  'semrushbot', 'ahrefs', 'mj12bot',
  'slackbot', 'discordbot', 'telegrambot', 'skypeuripreview',
  'whatsapp', 'redditbot',
  // AI crawlers
  'gptbot', 'chatgpt-user', 'oai-searchbot',
  'claudebot', 'anthropic-ai', 'claude-web',
  'perplexitybot', 'perplexity-user',
  'google-extended', 'ccbot', 'cohere-ai', 'amazonbot',
  'bytespider'
];

const STATIC_RE = /\.(js|mjs|css|xml|txt|png|jpg|jpeg|gif|pdf|doc|ico|rss|zip|mp3|rar|exe|wmv|avi|ppt|mpg|mpeg|tif|wav|mov|psd|ai|xls|mp4|m4a|swf|dat|dmg|iso|flv|m4v|torrent|ttf|woff|woff2|svg|eot|webp|avif|webm|map|json)$/i;

const ORIGIN = 'https://operatorintelligence.ai';
const LOVABLE_ORIGIN = 'https://operator-intelligence.lovable.app';
const DEFAULT_OG_IMAGE = 'https://storage.googleapis.com/gpt-engineer-file-uploads/61OXko9jszNmj34kxQdAIVvpq0w1/social-images/social-1772250699286-Screenshot_2026-02-27_at_10.51.30_PM.webp';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/|api/).*)']
};

// ------------------------------------------------------------------
// Per-URL metadata map. Edit here to update SEO copy for each URL.
// ------------------------------------------------------------------
const META = {
  '/': {
    title: 'Operator Intelligence | AI Enablement Consultancy for Modern Operators',
    description: 'Operator Intelligence helps restaurants, franchises, and service businesses deploy agentic AI, generative AI, and operations automation — led by MIT- and Anthropic-certified practitioners.',
    type: 'home'
  },
  '/services': {
    title: 'AI Enablement Services: Agentic Automation, GenAI & Infrastructure | Operator Intelligence',
    description: 'Services for operators: AI readiness assessments, agentic automation design, generative AI strategy, AI infrastructure & integration, customer experience AI systems, and workforce AI enablement.',
    type: 'service',
    breadcrumb: [['Home','/'], ['Services','/services']]
  },
  '/about': {
    title: 'About Operator Intelligence | AI Enablement Built by Operators',
    description: 'Founded by Chad Westleigh and Luke Freeman. MIT Applied Agentic AI certified. Anthropic AI Fluency certified. We build AI systems that work in real operations, not slide decks.',
    type: 'about',
    breadcrumb: [['Home','/'], ['About','/about']]
  },
  '/process': {
    title: 'Our Process: From AI Readiness to Production Deployment | Operator Intelligence',
    description: 'How we take operators from AI curiosity to measurable outcomes — assessment, design, build, and hand-off in six-to-twelve weeks per workflow.',
    type: 'service',
    breadcrumb: [['Home','/'], ['Process','/process']]
  },
  '/cases': {
    title: 'Case Studies: AI Implementations for Operators | Operator Intelligence',
    description: 'Real agentic AI deployments for restaurants, franchises, and service businesses. Outcomes, workflows, and lessons — not marketing fluff.',
    type: 'cases',
    breadcrumb: [['Home','/'], ['Cases','/cases']]
  },
  '/agents': {
    title: 'AI Agent Library for Operators | Operator Intelligence',
    description: 'A library of production-ready AI agents for operations, marketing, CX, hiring, and finance. Browse use cases, integrations, and deployment options.',
    type: 'agents',
    breadcrumb: [['Home','/'], ['Agents','/agents']]
  },
  '/alliance': {
    title: 'The Alliance: A Partner Program for AI-Enabled Operators | Operator Intelligence',
    description: 'Our partner program for operators, agencies, and platforms building the next generation of AI-enabled operations.',
    type: 'alliance',
    breadcrumb: [['Home','/'], ['Alliance','/alliance']]
  },
  '/promo-guide': {
    title: 'AI Enablement Promo Guide | Operator Intelligence',
    description: 'The Operator Intelligence promotional guide — a primer on AI enablement for operators, covering services, outcomes, and how we work.',
    type: 'guide',
    breadcrumb: [['Home','/'], ['Promo Guide','/promo-guide']]
  },
  '/insights': {
    title: 'Insights on Agentic AI for Modern Operators | Operator Intelligence',
    description: 'Essays and field notes on the operator side of AI — agentic workflows, workforce shifts, CX, and the economics of deployment.',
    type: 'blog',
    breadcrumb: [['Home','/'], ['Insights','/insights']]
  },
  '/insights/the-agentic-cmo': {
    title: 'The Agentic CMO: How AI Changes the Marketing Operating Model | Operator Intelligence',
    description: 'The marketing function is becoming agent-native. What the CMO role looks like when every workflow has an AI co-worker — and what to build first.',
    type: 'article',
    author: 'Chad Westleigh',
    breadcrumb: [['Home','/'], ['Insights','/insights'], ['The Agentic CMO','/insights/the-agentic-cmo']]
  },
  '/insights/the-talent-inversion': {
    title: 'The Talent Inversion: Why AI Inverts the Org Chart | Operator Intelligence',
    description: 'AI is not just a productivity lever. It is inverting who does what inside operator businesses. Here is the pattern we are seeing — and what to do with it.',
    type: 'article',
    author: 'Chad Westleigh',
    breadcrumb: [['Home','/'], ['Insights','/insights'], ['The Talent Inversion','/insights/the-talent-inversion']]
  },
  '/reports': {
    title: 'AI Gap Reports for Operators | Operator Intelligence',
    description: 'Our 2026 AI Gap report series for restaurants, franchises, and coaching firms — what is being adopted, what is being wasted, and where the moats are forming.',
    type: 'reports',
    breadcrumb: [['Home','/'], ['Reports','/reports']]
  },
  '/report/restaurant-ai-gap-2026': {
    title: 'Restaurant AI Gap Report 2026 | Operator Intelligence',
    description: 'Independent 2026 analysis of AI adoption across restaurants: what multi-unit operators are actually deploying, the economics, and the gap between leaders and the rest.',
    type: 'report',
    reportName: 'Restaurant AI Gap Report 2026',
    breadcrumb: [['Home','/'], ['Reports','/reports'], ['Restaurant AI Gap Report 2026','/report/restaurant-ai-gap-2026']]
  },
  '/report/franchise-ai-gap-2026': {
    title: 'Franchise AI Gap Report 2026 | Operator Intelligence',
    description: 'Where franchise systems are winning (and losing) with AI in 2026: corporate vs. franchisee adoption, tooling, and the playbooks that are working.',
    type: 'report',
    reportName: 'Franchise AI Gap Report 2026',
    breadcrumb: [['Home','/'], ['Reports','/reports'], ['Franchise AI Gap Report 2026','/report/franchise-ai-gap-2026']]
  },
  '/report/coaching-ai-gap-2026': {
    title: 'Coaching AI Gap Report 2026 | Operator Intelligence',
    description: 'How coaching and professional services firms are deploying AI in 2026 — client workflow automation, content systems, and the operator coach stack.',
    type: 'report',
    reportName: 'Coaching AI Gap Report 2026',
    breadcrumb: [['Home','/'], ['Reports','/reports'], ['Coaching AI Gap Report 2026','/report/coaching-ai-gap-2026']]
  },
  '/report/ai-enablement-promo-2026': {
    title: 'AI Enablement Promo 2026 | Operator Intelligence',
    description: 'Operator Intelligence 2026 promotional primer on AI enablement: services, offerings, and how we partner with modern operators.',
    type: 'report',
    reportName: 'AI Enablement Promo 2026',
    breadcrumb: [['Home','/'], ['Reports','/reports'], ['AI Enablement Promo 2026','/report/ai-enablement-promo-2026']]
  },
  '/privacy': {
    title: 'Privacy Policy | Operator Intelligence',
    description: 'Operator Intelligence privacy policy — how we collect, use, and protect data for visitors and clients.',
    type: 'legal',
    breadcrumb: [['Home','/'], ['Privacy','/privacy']]
  }
};

function getMeta(pathname) {
  // Strip trailing slash (except root)
  const key = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return META[key] || META[pathname] || {
    title: 'Operator Intelligence | AI Enablement for Modern Operators',
    description: 'Operator Intelligence helps businesses implement AI with precision — from agentic automations and generative AI to strategy, infrastructure, and customer experience systems.',
    type: 'other'
  };
}

// ------------------------------------------------------------------
// JSON-LD schema builders
// ------------------------------------------------------------------
function orgSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORIGIN + '/#organization',
    name: 'Operator Intelligence',
    url: ORIGIN,
    description: 'AI enablement consultancy helping businesses implement agentic automations, generative AI, and intelligent operations.',
    foundingDate: '2024',
    founder: [
      { '@type': 'Person', name: 'Chad Westleigh', jobTitle: 'Co-Founder' },
      { '@type': 'Person', name: 'Luke Freeman', jobTitle: 'Co-Founder' }
    ],
    knowsAbout: ['Artificial Intelligence','Business Automation','AI Strategy','Agentic AI','Generative AI','Restaurant AI','Franchise AI','Coaching AI'],
    hasCredential: [
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'certificate', name: 'MIT Certified in Applied Agentic AI for Organizational Transformation' },
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'certificate', name: 'Anthropic AI Fluency: Framework & Foundations' },
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'certificate', name: 'Anthropic Teaching AI Fluency' }
    ]
  };
}

function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': ORIGIN + '/#website',
    url: ORIGIN,
    name: 'Operator Intelligence',
    publisher: { '@id': ORIGIN + '/#organization' },
    inLanguage: 'en-US'
  };
}

function breadcrumbSchema(breadcrumb) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumb.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: ORIGIN + path
    }))
  };
}

function serviceSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'AI Enablement Services for Modern Operators',
    provider: { '@id': ORIGIN + '/#organization' },
    serviceType: 'AI Enablement Consulting',
    description: 'AI readiness assessments, agentic automation design and deployment, generative AI strategy, AI infrastructure and integration, customer experience AI systems, and workforce AI enablement.',
    areaServed: 'United States',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Operator Intelligence Services',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'AI Readiness Assessment', description: 'Evaluate organizational readiness for AI adoption across strategy, data, tech, people, and governance.' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Agentic Automation Design & Deployment', description: 'Design and ship production AI agents for operator workflows.' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Generative AI Strategy', description: 'GenAI strategy tailored to operator-led businesses.' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'AI Infrastructure & Integration', description: 'Integrate AI tooling into existing operations stacks.' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Customer Experience AI Systems', description: 'Build AI-driven customer experience systems.' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Workforce AI Enablement', description: 'Train teams to work with AI agents in their day-to-day operations.' } }
      ]
    }
  };
}

function articleSchema(meta, pathname) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': ORIGIN + pathname },
    author: {
      '@type': 'Person',
      name: meta.author || 'Chad Westleigh'
    },
    publisher: { '@id': ORIGIN + '/#organization' },
    inLanguage: 'en-US',
    image: meta.ogImage || DEFAULT_OG_IMAGE
  };
}

function reportSchema(meta, pathname) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: meta.reportName || meta.title,
    headline: meta.title,
    description: meta.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': ORIGIN + pathname },
    author: { '@id': ORIGIN + '/#organization' },
    publisher: { '@id': ORIGIN + '/#organization' },
    datePublished: '2026-01-01',
    inLanguage: 'en-US',
    image: meta.ogImage || DEFAULT_OG_IMAGE
  };
}

function personSchema(name, jobTitle) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle,
    worksFor: { '@id': ORIGIN + '/#organization' }
  };
}

function collectSchemas(meta, pathname) {
  const schemas = [orgSchema()];
  if (pathname === '/') schemas.push(websiteSchema());
  if (meta.breadcrumb) schemas.push(breadcrumbSchema(meta.breadcrumb));
  if (meta.type === 'service') schemas.push(serviceSchema());
  if (meta.type === 'article') schemas.push(articleSchema(meta, pathname));
  if (meta.type === 'report') schemas.push(reportSchema(meta, pathname));
  if (meta.type === 'about') {
    schemas.push(personSchema('Chad Westleigh', 'Co-Founder'));
    schemas.push(personSchema('Luke Freeman', 'Co-Founder'));
  }
  return schemas;
}

// ------------------------------------------------------------------
// HTML head rewriting
// ------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHeadExtras(pathname, meta) {
  const canonical = ORIGIN + (pathname === '/' ? '/' : pathname.replace(/\/$/, ''));
  const ogImage = meta.ogImage || DEFAULT_OG_IMAGE;
  const schemas = collectSchemas(meta, pathname);

  const headExtras = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<link rel="alternate" hreflang="en" href="${escapeHtml(canonical)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="${meta.type === 'article' ? 'article' : 'website'}" />`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
    `<meta property="og:site_name" content="Operator Intelligence" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    ...schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
  ];
  return headExtras.join('\n    ');
}

function rewriteHtml(html, pathname, meta) {
  const canonical = ORIGIN + (pathname === '/' ? '/' : pathname.replace(/\/$/, ''));

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);

  // Replace <meta name="description">
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}">`);

  // Strip existing canonical, og:*, twitter:*, robots, existing JSON-LD org/website (we re-emit canonical per-URL)
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '');
  html = html.replace(/<link\s+rel=["']alternate["']\s+hreflang=[^>]*>\s*/gi, '');
  html = html.replace(/<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, '');
  html = html.replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '');
  html = html.replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, '');
  // Strip only the homepage Organization schema the source already injects; we emit a fresh one
  html = html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  // Inject new head block just before </head>
  const headExtras = buildHeadExtras(pathname, meta);
  html = html.replace(/<\/head>/i, `    ${headExtras}\n  </head>`);

  return html;
}

// ------------------------------------------------------------------
// Bot fetch (try LovableHTML prerender, fallback to Lovable SPA)
// ------------------------------------------------------------------
async function fetchForBot(pathname, search, incomingHeaders) {
  const targetUrl = `${ORIGIN}${pathname}${search || ''}`;
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.LOVABLEHTML_API_KEY : null;

  // First attempt: LovableHTML prerender API (renders the SPA in a headless browser)
  if (apiKey) {
    try {
      const prerenderUrl = `https://api.lovablehtml.com/api/prerender/render?url=${encodeURIComponent(targetUrl)}`;
      const r = await fetch(prerenderUrl, {
        headers: {
          'x-lovablehtml-api-key': apiKey,
          'Accept': 'text/html',
          'User-Agent': incomingHeaders.get('user-agent') || '',
          'Accept-Language': incomingHeaders.get('accept-language') || ''
        }
      });
      if (r.ok) {
        return { html: await r.text(), source: 'lovablehtml', status: r.status };
      }
      // If prerender says 304 or errors, fall through to SPA
    } catch (_) {
      // Fall through
    }
  }

  // Fallback: fetch the Lovable app HTML directly (empty shell; we still rewrite head)
  const lovableUrl = `${LOVABLE_ORIGIN}${pathname}${search || ''}`;
  const r = await fetch(lovableUrl, {
    headers: {
      'Accept': 'text/html',
      'User-Agent': incomingHeaders.get('user-agent') || ''
    }
  });
  return { html: await r.text(), source: 'lovable-fallback', status: r.status };
}

// ------------------------------------------------------------------
// Main middleware
// ------------------------------------------------------------------
export default async function middleware(request) {
  const url = new URL(request.url);
  const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
  const pathname = url.pathname;

  // Short-circuit static assets
  if (STATIC_RE.test(pathname)) return;
  if (request.method !== 'GET') return;

  const isBot = BOT_USER_AGENTS.some(b => userAgent.includes(b));

  // Non-bots: pass through to vercel.json rewrite (Lovable SPA)
  if (!isBot) return;

  try {
    const { html, source, status } = await fetchForBot(pathname, url.search, request.headers);
    const meta = getMeta(pathname);
    const rewritten = rewriteHtml(html, pathname, meta);

    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-OI-Middleware': 'v2',
        'X-OI-Prerender-Source': source,
        'X-OI-Prerender-Upstream-Status': String(status),
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (err) {
    // Fail open — return undefined so Vercel falls through to vercel.json rewrites
    console.error('[OI middleware] error:', err);
    return;
  }
}

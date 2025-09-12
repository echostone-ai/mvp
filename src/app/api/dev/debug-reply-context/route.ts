import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint that mimics the reply route to see what's happening with context
 */
export async function POST(req: NextRequest) {
  try {
    // Extract the same data as the reply route
    const { prompt, avatarSlug = 'jonathan_braden', debug } = await req.json();
    
    // Check cookies
    const cookiesHeader = req.headers.get('cookie') || '';
    const cookieMap = Object.fromEntries(cookiesHeader.split(/;\s*/).filter(Boolean).map(p => {
      const idx = p.indexOf('=');
      return idx === -1 ? [p, ''] : [decodeURIComponent(p.slice(0, idx)), decodeURIComponent(p.slice(idx + 1))];
    }));
    const visitorId = cookieMap['jd_vid'] || 'NO_VISITOR_ID';

    return NextResponse.json({
      success: true,
      debug_info: {
        received_prompt: prompt,
        received_avatar_slug: avatarSlug,
        received_debug: debug,
        extracted_visitor_id: visitorId,
        has_visitor_cookie: !!cookieMap['jd_vid'],
        all_cookies: Object.keys(cookieMap),
        raw_cookie_header: cookiesHeader
      },
      recommendations: [
        !cookieMap['jd_vid'] ? 'No visitor ID cookie found - conversation history will not work properly' : null,
        avatarSlug !== 'jonathan-demo' ? `Avatar slug is "${avatarSlug}" but jonathan-demo page should use "jonathan-demo"` : null,
        !prompt ? 'No prompt provided' : null
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('Reply context debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
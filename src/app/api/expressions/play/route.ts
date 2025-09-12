export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/runtime/singletons';

export async function POST(req: Request) {
  try {
    const { avatarId, type, tone } = await req.json();
    
    console.log('🎭 Expression API called with:', { avatarId, type, tone });
    
    if (!avatarId) {
      return NextResponse.json({ error: 'Avatar ID required' }, { status: 400 });
    }

    // Query expressions for the avatar (both avatar-owned and user-owned)
    console.log('🎭 Querying expressions for:', { avatarId });
    const { data: expressions, error } = await supabase
      .from('expression_clips')
      .select('*')
      .or(`and(owner_key.eq.${avatarId},owner_type.eq.avatar),and(owner_key.eq.${avatarId},owner_type.eq.user)`)
      .eq('status', 'active')
      .order('priority', { ascending: false });

    console.log('🎭 Database query result:', { expressions, error });

    if (error) {
      console.error('Expression query error:', error);
      return NextResponse.json({ error: 'Failed to fetch expressions', details: error }, { status: 500 });
    }

    if (!expressions || expressions.length === 0) {
      console.log('🎭 No expressions found for avatar:', avatarId);
      return NextResponse.json({ error: 'No expressions found', avatarId }, { status: 404 });
    }

    console.log('🎭 Found expressions:', expressions.map(e => ({ id: e.id, type: e.type, filename: e.filename })));

    // Filter by type if specified
    let filteredExpressions = expressions;
    if (type) {
      filteredExpressions = expressions.filter(expr => 
        expr.type === type || 
        (expr.placement_hints && expr.placement_hints.includes(type))
      );
    }

    // Filter by tone if specified
    if (tone && filteredExpressions.length > 0) {
      const toneFiltered = filteredExpressions.filter(expr => expr.tone === tone);
      if (toneFiltered.length > 0) {
        filteredExpressions = toneFiltered;
      }
    }

    if (filteredExpressions.length === 0) {
      return NextResponse.json({ error: 'No matching expressions found' }, { status: 404 });
    }

    // Pick a random expression from the filtered list
    const randomExpression = filteredExpressions[Math.floor(Math.random() * filteredExpressions.length)];

    return NextResponse.json({
      success: true,
      expression: {
        id: randomExpression.id,
        type: randomExpression.type,
        tone: randomExpression.tone,
        cdnUrl: randomExpression.cdn_url,
        filename: randomExpression.filename
      }
    });

  } catch (error) {
    console.error('Expression play API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
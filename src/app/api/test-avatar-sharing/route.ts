import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Test avatar sharing endpoint called');
    
    const body = await request.json();
    console.log('Received body:', JSON.stringify(body, null, 2));
    
    // Check if all required fields are present
    const { action, avatarId, ownerEmail, shareWithEmail } = body;
    
    const validation = {
      hasAction: !!action,
      hasAvatarId: !!avatarId,
      hasOwnerEmail: !!ownerEmail,
      hasShareWithEmail: !!shareWithEmail,
      actionValue: action,
      avatarIdValue: avatarId,
      ownerEmailValue: ownerEmail,
      shareWithEmailValue: shareWithEmail
    };
    
    console.log('Validation check:', validation);
    
    if (!action) {
      return NextResponse.json({ 
        error: 'Missing action',
        received: body,
        validation
      }, { status: 400 });
    }
    
    if (!avatarId) {
      return NextResponse.json({ 
        error: 'Missing avatarId',
        received: body,
        validation
      }, { status: 400 });
    }
    
    if (!ownerEmail) {
      return NextResponse.json({ 
        error: 'Missing ownerEmail',
        received: body,
        validation
      }, { status: 400 });
    }
    
    if (!shareWithEmail) {
      return NextResponse.json({ 
        error: 'Missing shareWithEmail',
        received: body,
        validation
      }, { status: 400 });
    }
    
    // If we get here, all required fields are present
    return NextResponse.json({
      success: true,
      message: 'All validation passed!',
      received: body,
      validation
    });
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
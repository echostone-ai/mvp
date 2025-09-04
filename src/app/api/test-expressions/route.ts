import { NextRequest, NextResponse } from 'next/server'
import { UniversalExpressionService } from '@/lib/services/universalExpressionService'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const avatarId = searchParams.get('avatarId') || 'jonathan-demo'
  const text = searchParams.get('text') || 'That is absolutely hilarious!'

  try {
    console.log(`🎭 Testing expressions for avatar: ${avatarId}`)
    console.log(`🎭 Test text: "${text}"`)

    // Create expression player
    const player = await UniversalExpressionService.createExpressionPlayer(avatarId)
    
    if (!player) {
      return NextResponse.json({
        success: false,
        error: 'Could not create expression player',
        avatarId,
        text
      })
    }

    // Test expression matching (this will log to server console)
    await player.playExpressionsForText(text)

    return NextResponse.json({
      success: true,
      message: 'Expression test completed - check server console for details',
      avatarId,
      text
    })

  } catch (error) {
    console.error('🎭 Expression test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      avatarId,
      text
    })
  }
}
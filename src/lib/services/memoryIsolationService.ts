import { NextRequest, NextResponse } from 'next/server';

export interface AvatarIsolationParams {
  action: 'test-avatar-isolation';
  avatarId: string;
  userId: string;
  message?: string;
}

export interface UserIsolationParams {
  action: 'test-user-isolation';
  shareToken: string;
  userId: string;
  message?: string;
}

export async function testAvatarIsolation(data: AvatarIsolationParams, request: NextRequest): Promise<NextResponse> {
  const { avatarId, userId, message } = data;
  
  // Create a unique memory for this avatar
  const avatarMemory = `Memory for avatar ${avatarId}: ${message || 'This is a test memory'}`;

  // In a real implementation, this would save to a database
  console.log(`Creating isolated memory for avatar ${avatarId}, user ${userId}: ${avatarMemory}`);

  return NextResponse.json({
    success: true,
    avatarId,
    userId,
    memory: avatarMemory,
    timestamp: new Date().toISOString()
  });
}

export async function testUserIsolation(data: UserIsolationParams, request: NextRequest): Promise<NextResponse> {
  const { shareToken, userId, message } = data;
  
  // Create a unique memory for this user of the shared avatar
  const userMemory = `Memory for user ${userId} with shared avatar (token: ${shareToken}): ${message || 'This is a test memory'}`;

  // In a real implementation, this would save to a database
  console.log(`Creating isolated memory for shared avatar ${shareToken}, user ${userId}: ${userMemory}`);

  return NextResponse.json({
    success: true,
    shareToken,
    userId,
    memory: userMemory,
    timestamp: new Date().toISOString()
  });
}
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "This endpoint is under development" }, { status: 503 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: "This endpoint is under development" }, { status: 503 });
}
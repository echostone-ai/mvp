import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "This endpoint is under development" }, { status: 503 });
}

export async function PUT(request: NextRequest) {
  return NextResponse.json({ message: "This endpoint is under development" }, { status: 503 });
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ message: "This endpoint is under development" }, { status: 503 });
}
/**
 * Individual Expression Management API
 * Handles PATCH and DELETE operations for specific expressions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureFlag } from '../../../../lib/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/expressions/[id] - Update expression metadata
 * Body: { status?, priority?, tone?, placement_hints? }
 */
async function handlePATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Expression ID is required' },
        { status: 400 }
      );
    }

    // Validate update fields
    const allowedFields = ['status', 'priority', 'tone', 'placement_hints'];
    const updateData: any = {};
    
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ['active', 'inactive', 'processing', 'failed'];
      if (!validStatuses.includes(updateData.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Import the storage service
    const { ExpressionStorageService } = await import('../../../../lib/services/expressionStorageService');
    
    const updatedExpression = await ExpressionStorageService.updateExpression(id, updateData);

    if (!updatedExpression) {
      return NextResponse.json(
        { success: false, error: 'Expression not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      expression: updatedExpression
    });

  } catch (error) {
    console.error('Error updating expression:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update expression' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expressions/[id] - Delete expression
 */
async function handleDELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Expression ID is required' },
        { status: 400 }
      );
    }

    // Import the storage service
    const { ExpressionStorageService } = await import('../../../../lib/services/expressionStorageService');
    
    const deleted = await ExpressionStorageService.deleteExpression(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Expression not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Expression deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting expression:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete expression' },
      { status: 500 }
    );
  }
}

// Apply feature flag middleware
export const PATCH = requireFeatureFlag('VOICE_OVERLAYS')(handlePATCH);
export const DELETE = requireFeatureFlag('VOICE_OVERLAYS')(handleDELETE);
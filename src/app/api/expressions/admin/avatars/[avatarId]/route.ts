/**
 * Admin Avatar Expression Management API
 * Handles CRUD operations for avatar-specific expressions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureFlag } from '../../../../../../lib/featureFlags';
import { ExpressionStorageService } from '../../../../../../lib/services/expressionStorageService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/expressions/admin/avatars/[avatarId] - List expressions for avatar
 * Query params:
 * - type: expression_type (optional)
 * - status: expression_status (optional)
 * - limit: number (optional, default 100)
 * - offset: number (optional, default 0)
 */
async function handleGET(request: NextRequest, { params }: { params: { avatarId: string } }) {
  try {
    const { avatarId } = params;
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type');
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!avatarId) {
      return NextResponse.json(
        { success: false, error: 'Avatar ID is required' },
        { status: 400 }
      );
    }

    console.log(`[ADMIN AVATAR EXPRESSIONS] Listing expressions for avatar: ${avatarId}`);

    const expressions = await ExpressionStorageService.listExpressions({
      ownerType: 'avatar',
      ownerKey: avatarId,
      type: type as any,
      status: status as any,
      limit,
      offset
    });

    const total = await ExpressionStorageService.countExpressions({
      ownerType: 'avatar',
      ownerKey: avatarId,
      type: type as any,
      status: status as any
    });

    // Group expressions by type for easier management
    const expressionsByType = expressions.reduce((acc, expr) => {
      if (!acc[expr.type]) {
        acc[expr.type] = [];
      }
      acc[expr.type].push(expr);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      success: true,
      avatarId,
      expressions,
      expressionsByType,
      total,
      limit,
      offset,
      stats: {
        totalActive: expressions.filter(e => e.status === 'active').length,
        totalInactive: expressions.filter(e => e.status === 'inactive').length,
        averagePriority: expressions.length > 0 
          ? Math.round(expressions.reduce((sum, e) => sum + e.priority, 0) / expressions.length)
          : 0,
        typeDistribution: Object.keys(expressionsByType).reduce((acc, type) => {
          acc[type] = expressionsByType[type].length;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  } catch (error) {
    console.error('Error listing avatar expressions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list avatar expressions' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/expressions/admin/avatars/[avatarId] - Bulk update avatar expressions
 * Body: { updates: Array<{ id: string, status?, priority?, tone?, placement_hints? }> }
 */
async function handlePATCH(request: NextRequest, { params }: { params: { avatarId: string } }) {
  try {
    const { avatarId } = params;
    const body = await request.json();

    if (!avatarId) {
      return NextResponse.json(
        { success: false, error: 'Avatar ID is required' },
        { status: 400 }
      );
    }

    if (!body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { success: false, error: 'Updates array is required' },
        { status: 400 }
      );
    }

    console.log(`[ADMIN AVATAR EXPRESSIONS] Bulk updating ${body.updates.length} expressions for avatar: ${avatarId}`);

    const results = [];
    const errors = [];

    // Process each update
    for (const update of body.updates) {
      try {
        if (!update.id) {
          errors.push('Missing expression ID in update');
          continue;
        }

        // Validate update fields
        const allowedFields = ['status', 'priority', 'tone', 'placement_hints'];
        const updateData: any = {};
        
        for (const [key, value] of Object.entries(update)) {
          if (key !== 'id' && allowedFields.includes(key)) {
            updateData[key] = value;
          }
        }

        if (Object.keys(updateData).length === 0) {
          errors.push(`No valid fields to update for expression ${update.id}`);
          continue;
        }

        // Validate status if provided
        if (updateData.status) {
          const validStatuses = ['active', 'inactive', 'processing', 'failed'];
          if (!validStatuses.includes(updateData.status)) {
            errors.push(`Invalid status for expression ${update.id}: ${updateData.status}`);
            continue;
          }
        }

        // Validate priority if provided
        if (updateData.priority !== undefined) {
          const priority = parseInt(updateData.priority);
          if (isNaN(priority) || priority < 0 || priority > 100) {
            errors.push(`Invalid priority for expression ${update.id}: must be 0-100`);
            continue;
          }
          updateData.priority = priority;
        }

        const updatedExpression = await ExpressionStorageService.updateExpression(update.id, updateData);

        if (!updatedExpression) {
          errors.push(`Expression not found: ${update.id}`);
          continue;
        }

        // Verify the expression belongs to this avatar
        if (updatedExpression.ownerId !== avatarId || updatedExpression.ownerType !== 'avatar') {
          errors.push(`Expression ${update.id} does not belong to avatar ${avatarId}`);
          continue;
        }

        results.push({
          id: update.id,
          updated: updateData,
          expression: updatedExpression
        });

      } catch (error: any) {
        errors.push(`Failed to update expression ${update.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      avatarId,
      processed: results.length,
      total: body.updates.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error bulk updating avatar expressions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk update avatar expressions' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expressions/admin/avatars/[avatarId] - Delete all expressions for avatar
 * Query params:
 * - confirm: 'true' (required for safety)
 * - type: expression_type (optional, to delete only specific type)
 */
async function handleDELETE(request: NextRequest, { params }: { params: { avatarId: string } }) {
  try {
    const { avatarId } = params;
    const { searchParams } = new URL(request.url);
    
    const confirm = searchParams.get('confirm');
    const type = searchParams.get('type');

    if (!avatarId) {
      return NextResponse.json(
        { success: false, error: 'Avatar ID is required' },
        { status: 400 }
      );
    }

    if (confirm !== 'true') {
      return NextResponse.json(
        { success: false, error: 'Confirmation required: add ?confirm=true to delete expressions' },
        { status: 400 }
      );
    }

    console.log(`[ADMIN AVATAR EXPRESSIONS] Deleting expressions for avatar: ${avatarId}${type ? ` (type: ${type})` : ''}`);

    // Get expressions to delete
    const expressions = await ExpressionStorageService.listExpressions({
      ownerType: 'avatar',
      ownerKey: avatarId,
      type: type as any,
      limit: 1000 // Get all expressions
    });

    const results = [];
    const errors = [];

    // Delete each expression
    for (const expression of expressions) {
      try {
        const deleted = await ExpressionStorageService.deleteExpression(expression.id);
        if (deleted) {
          results.push({
            id: expression.id,
            filename: expression.filename,
            type: expression.type
          });
        } else {
          errors.push(`Failed to delete expression: ${expression.id}`);
        }
      } catch (error: any) {
        errors.push(`Error deleting expression ${expression.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      avatarId,
      deleted: results.length,
      total: expressions.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error deleting avatar expressions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete avatar expressions' },
      { status: 500 }
    );
  }
}

// Apply feature flag middleware
export const GET = requireFeatureFlag('VOICE_OVERLAYS')(handleGET);
export const PATCH = requireFeatureFlag('VOICE_OVERLAYS')(handlePATCH);
export const DELETE = requireFeatureFlag('VOICE_OVERLAYS')(handleDELETE);
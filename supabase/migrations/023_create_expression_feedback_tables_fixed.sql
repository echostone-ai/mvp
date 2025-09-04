-- Migration: Create Expression Feedback and Learning Tables (Fixed)
-- Supports advanced expression scheduling with user feedback and learning

-- Expression feedback table for collecting user reactions
CREATE TABLE IF NOT EXISTS expression_feedback (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    expression_id TEXT NOT NULL,
    expression_type TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('explicit', 'implicit')),
    rating DECIMAL(3,2) NOT NULL CHECK (rating >= 0 AND rating <= 1),
    context JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_profiles table if it doesn't exist, then add expression_preferences column
DO $ 
BEGIN
    -- First, create user_profiles table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        CREATE TABLE user_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id)
        );
    END IF;
    
    -- Then add expression_preferences column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'expression_preferences'
    ) THEN
        ALTER TABLE user_profiles 
        ADD COLUMN expression_preferences JSONB;
    END IF;
END $;

-- Expression learning patterns table for storing user behavior patterns
CREATE TABLE IF NOT EXISTS expression_learning_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patterns JSONB NOT NULL,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Expression usage analytics table for tracking expression performance
CREATE TABLE IF NOT EXISTS expression_usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expression_id TEXT NOT NULL,
    expression_type TEXT NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    positive_reactions INTEGER NOT NULL DEFAULT 0,
    negative_reactions INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    context_success JSONB NOT NULL DEFAULT '{}',
    emotional_success JSONB NOT NULL DEFAULT '{}',
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(expression_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expression_feedback_user_id ON expression_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_expression_feedback_session_id ON expression_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_expression_feedback_expression_type ON expression_feedback(expression_type);
CREATE INDEX IF NOT EXISTS idx_expression_feedback_timestamp ON expression_feedback(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_expression_feedback_processed ON expression_feedback(processed) WHERE NOT processed;

CREATE INDEX IF NOT EXISTS idx_expression_learning_patterns_user_id ON expression_learning_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_expression_learning_patterns_updated ON expression_learning_patterns(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_expression_usage_analytics_expression_id ON expression_usage_analytics(expression_id);
CREATE INDEX IF NOT EXISTS idx_expression_usage_analytics_type ON expression_usage_analytics(expression_type);
CREATE INDEX IF NOT EXISTS idx_expression_usage_analytics_rating ON expression_usage_analytics(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_expression_usage_analytics_last_used ON expression_usage_analytics(last_used DESC);

-- GIN indexes for JSONB columns (skip if they cause memory issues)
DO $
BEGIN
    BEGIN
        CREATE INDEX IF NOT EXISTS idx_expression_feedback_context_gin ON expression_feedback USING GIN(context);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipped GIN index on expression_feedback.context due to memory constraints';
    END;
    
    BEGIN
        CREATE INDEX IF NOT EXISTS idx_expression_learning_patterns_gin ON expression_learning_patterns USING GIN(patterns);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipped GIN index on expression_learning_patterns.patterns due to memory constraints';
    END;
    
    BEGIN
        CREATE INDEX IF NOT EXISTS idx_expression_usage_context_success_gin ON expression_usage_analytics USING GIN(context_success);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipped GIN index on expression_usage_analytics.context_success due to memory constraints';
    END;
    
    BEGIN
        CREATE INDEX IF NOT EXISTS idx_expression_usage_emotional_success_gin ON expression_usage_analytics USING GIN(emotional_success);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipped GIN index on expression_usage_analytics.emotional_success due to memory constraints';
    END;
END $;

-- RLS policies
ALTER TABLE expression_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE expression_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE expression_usage_analytics ENABLE ROW LEVEL SECURITY;

-- Users can only access their own feedback
DROP POLICY IF EXISTS "Users can view own expression feedback" ON expression_feedback;
CREATE POLICY "Users can view own expression feedback" ON expression_feedback
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own expression feedback" ON expression_feedback;
CREATE POLICY "Users can insert own expression feedback" ON expression_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only access their own learning patterns
DROP POLICY IF EXISTS "Users can view own learning patterns" ON expression_learning_patterns;
CREATE POLICY "Users can view own learning patterns" ON expression_learning_patterns
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own learning patterns" ON expression_learning_patterns;
CREATE POLICY "Users can insert own learning patterns" ON expression_learning_patterns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own learning patterns" ON expression_learning_patterns;
CREATE POLICY "Users can update own learning patterns" ON expression_learning_patterns
    FOR UPDATE USING (auth.uid() = user_id);

-- Expression usage analytics are read-only for users, writable by service
DROP POLICY IF EXISTS "Users can view expression usage analytics" ON expression_usage_analytics;
CREATE POLICY "Users can view expression usage analytics" ON expression_usage_analytics
    FOR SELECT USING (true); -- Public read access for analytics

-- Function to update expression usage analytics
CREATE OR REPLACE FUNCTION update_expression_usage_analytics()
RETURNS TRIGGER AS $
BEGIN
    -- Update or insert usage analytics when feedback is added
    INSERT INTO expression_usage_analytics (
        expression_id,
        expression_type,
        usage_count,
        positive_reactions,
        negative_reactions,
        average_rating,
        last_used
    )
    VALUES (
        NEW.expression_id,
        NEW.expression_type,
        1,
        CASE WHEN NEW.rating > 0.6 THEN 1 ELSE 0 END,
        CASE WHEN NEW.rating < 0.4 THEN 1 ELSE 0 END,
        NEW.rating,
        NEW.timestamp
    )
    ON CONFLICT (expression_id) DO UPDATE SET
        usage_count = expression_usage_analytics.usage_count + 1,
        positive_reactions = expression_usage_analytics.positive_reactions + 
            CASE WHEN NEW.rating > 0.6 THEN 1 ELSE 0 END,
        negative_reactions = expression_usage_analytics.negative_reactions + 
            CASE WHEN NEW.rating < 0.4 THEN 1 ELSE 0 END,
        average_rating = (
            (expression_usage_analytics.average_rating * expression_usage_analytics.usage_count) + NEW.rating
        ) / (expression_usage_analytics.usage_count + 1),
        last_used = NEW.timestamp,
        updated_at = NOW();
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger to automatically update analytics
DROP TRIGGER IF EXISTS trigger_update_expression_usage_analytics ON expression_feedback;
CREATE TRIGGER trigger_update_expression_usage_analytics
    AFTER INSERT ON expression_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_expression_usage_analytics();

-- Function to clean up old feedback data
CREATE OR REPLACE FUNCTION cleanup_old_expression_feedback(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM expression_feedback 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Function to get user expression preferences with defaults
CREATE OR REPLACE FUNCTION get_user_expression_preferences(p_user_id UUID)
RETURNS JSONB AS $
DECLARE
    preferences JSONB;
    default_preferences JSONB := '{
        "expressionFrequency": "medium",
        "preferredTypes": [],
        "dislikedTypes": [],
        "adaptiveSettings": {
            "learningEnabled": true,
            "feedbackWeight": 0.7,
            "contextWeight": 0.8,
            "emotionalSensitivity": 0.6
        },
        "privacySettings": {
            "shareUsageData": false,
            "allowPersonalization": true,
            "retainLearningData": true
        },
        "version": 1
    }';
BEGIN
    SELECT expression_preferences INTO preferences
    FROM user_profiles
    WHERE user_id = p_user_id;
    
    IF preferences IS NULL THEN
        RETURN default_preferences;
    ELSE
        RETURN preferences;
    END IF;
END;
$ LANGUAGE plpgsql;

-- Function to get expression analytics for a user
CREATE OR REPLACE FUNCTION get_user_expression_analytics(p_user_id UUID)
RETURNS JSONB AS $
DECLARE
    result JSONB;
BEGIN
    WITH feedback_stats AS (
        SELECT 
            COUNT(*) as total_feedback,
            AVG(rating) as average_rating,
            expression_type,
            COUNT(*) FILTER (WHERE rating > 0.6) as positive_count,
            COUNT(*) FILTER (WHERE rating < 0.4) as negative_count
        FROM expression_feedback 
        WHERE user_id = p_user_id 
        AND timestamp > NOW() - INTERVAL '30 days'
        GROUP BY expression_type
    ),
    emotional_stats AS (
        SELECT 
            context->>'emotionalTone' as emotional_tone,
            AVG(rating) as average_rating,
            COUNT(*) as count
        FROM expression_feedback 
        WHERE user_id = p_user_id 
        AND timestamp > NOW() - INTERVAL '30 days'
        GROUP BY context->>'emotionalTone'
    )
    SELECT jsonb_build_object(
        'totalFeedback', COALESCE((SELECT SUM(total_feedback) FROM feedback_stats), 0),
        'averageRating', COALESCE((SELECT AVG(average_rating) FROM feedback_stats), 0.5),
        'feedbackByType', COALESCE((
            SELECT jsonb_object_agg(
                expression_type,
                jsonb_build_object(
                    'count', total_feedback,
                    'averageRating', average_rating,
                    'positiveRate', CASE WHEN total_feedback > 0 THEN positive_count::FLOAT / total_feedback ELSE 0 END
                )
            )
            FROM feedback_stats
        ), '{}'),
        'contextualPerformance', COALESCE((
            SELECT jsonb_object_agg(
                emotional_tone,
                jsonb_build_object(
                    'count', count,
                    'averageRating', average_rating
                )
            )
            FROM emotional_stats
        ), '{}')
    ) INTO result;
    
    RETURN result;
END;
$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON expression_feedback TO authenticated;
GRANT ALL ON expression_learning_patterns TO authenticated;
GRANT SELECT ON expression_usage_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_expression_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_expression_analytics(UUID) TO authenticated;
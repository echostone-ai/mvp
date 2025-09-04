-- Migration: Create fact_history table for tracking changes to quick_facts
-- This table maintains an audit trail of all fact changes for debugging and analysis

-- Create the fact_history table
CREATE TABLE public.fact_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id UUID NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    old_value TEXT, -- NULL for new facts
    new_value TEXT NOT NULL,
    old_confidence FLOAT, -- Previous confidence score
    new_confidence FLOAT NOT NULL,
    old_priority INTEGER, -- Previous priority
    new_priority INTEGER NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('insert', 'update', 'delete')),
    change_source TEXT DEFAULT 'conversation' CHECK (change_source IN ('conversation', 'manual', 'system', 'migration')),
    source_reference TEXT, -- Reference to what triggered the change
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by TEXT -- Optional identifier for who/what made the change
);

-- Create indexes for efficient querying
CREATE INDEX fact_history_avatar_idx ON public.fact_history(avatar_id);
CREATE INDEX fact_history_key_idx ON public.fact_history(avatar_id, key);
CREATE INDEX fact_history_changed_at_idx ON public.fact_history(changed_at);
CREATE INDEX fact_history_change_type_idx ON public.fact_history(change_type);

-- Enable Row Level Security (RLS)
ALTER TABLE public.fact_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for public read access (for debugging and analysis)
CREATE POLICY "Public read access for fact_history" ON public.fact_history
    FOR SELECT USING (true);

-- Create RLS policy for service-level writes only
-- Only the service role can insert history records
CREATE POLICY "Service role can manage fact_history" ON public.fact_history
    FOR ALL USING (auth.role() = 'service_role');

-- Create function to automatically log fact changes
CREATE OR REPLACE FUNCTION log_fact_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT (new fact)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.fact_history (
            avatar_id, key, old_value, new_value, 
            old_confidence, new_confidence, old_priority, new_priority,
            change_type, change_source, source_reference, changed_by
        ) VALUES (
            NEW.avatar_id, NEW.key, NULL, NEW.value,
            NULL, NEW.confidence, NULL, NEW.priority,
            'insert', COALESCE(NEW.source, 'extraction'), NEW.source_reference, 'system'
        );
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE (fact changed)
    IF TG_OP = 'UPDATE' THEN
        -- Only log if the value, confidence, or priority actually changed
        IF OLD.value != NEW.value OR OLD.confidence != NEW.confidence OR OLD.priority != NEW.priority THEN
            INSERT INTO public.fact_history (
                avatar_id, key, old_value, new_value,
                old_confidence, new_confidence, old_priority, new_priority,
                change_type, change_source, source_reference, changed_by
            ) VALUES (
                NEW.avatar_id, NEW.key, OLD.value, NEW.value,
                OLD.confidence, NEW.confidence, OLD.priority, NEW.priority,
                'update', COALESCE(NEW.source, 'extraction'), NEW.source_reference, 'system'
            );
        END IF;
        RETURN NEW;
    END IF;
    
    -- Handle DELETE (fact removed)
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.fact_history (
            avatar_id, key, old_value, new_value,
            old_confidence, new_confidence, old_priority, new_priority,
            change_type, change_source, changed_by
        ) VALUES (
            OLD.avatar_id, OLD.key, OLD.value, '',
            OLD.confidence, 0.0, OLD.priority, 10,
            'delete', 'system', 'system'
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger to automatically log all changes to quick_facts
CREATE TRIGGER log_quick_facts_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.quick_facts
    FOR EACH ROW
    EXECUTE FUNCTION log_fact_change();

-- Add helpful comments for documentation
COMMENT ON TABLE public.fact_history IS 'Audit trail for all changes to quick_facts table';
COMMENT ON COLUMN public.fact_history.change_type IS 'Type of change: insert, update, or delete';
COMMENT ON COLUMN public.fact_history.change_source IS 'What triggered the change: conversation, manual, system, or migration';
COMMENT ON COLUMN public.fact_history.source_reference IS 'Reference to the source that triggered this change';
COMMENT ON COLUMN public.fact_history.changed_by IS 'Identifier for who or what made the change';
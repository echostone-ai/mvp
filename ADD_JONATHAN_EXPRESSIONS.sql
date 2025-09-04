-- Add Jonathan-Demo Expressions to Database
-- Run this in your Supabase SQL Editor

-- Insert sample expressions for jonathan-demo avatar
INSERT INTO public.expression_clips (
    owner_type,
    owner_key,
    filename,
    type,
    tone,
    placement_hints,
    duration_ms,
    cdn_url,
    priority,
    status
) VALUES 
-- Laugh expressions
(
    'avatar',
    'jonathan-demo',
    'jonathan_laugh_cheerful.mp3',
    'laugh',
    'cheerful',
    ARRAY['funny', 'joke', 'humor', 'amusing', 'hilarious'],
    250,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_laugh_cheerful.mp3',
    70,
    'active'
),
(
    'avatar',
    'jonathan-demo',
    'jonathan_laugh_hearty.mp3',
    'laugh',
    'hearty',
    ARRAY['funny', 'laughter', 'comedy'],
    280,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_laugh_hearty.mp3',
    65,
    'active'
),
-- Sigh expressions
(
    'avatar',
    'jonathan-demo',
    'jonathan_sigh_thoughtful.mp3',
    'sigh',
    'thoughtful',
    ARRAY['unfortunately', 'sadly', 'disappointing', 'tough'],
    200,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_sigh_thoughtful.mp3',
    60,
    'active'
),
(
    'avatar',
    'jonathan-demo',
    'jonathan_sigh_resigned.mp3',
    'sigh',
    'resigned',
    ARRAY['oh well', 'regret', 'sigh'],
    180,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_sigh_resigned.mp3',
    55,
    'active'
),
-- Breath expressions
(
    'avatar',
    'jonathan-demo',
    'jonathan_breath_natural.mp3',
    'breath',
    'natural',
    ARRAY[]::TEXT[],
    150,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_breath_natural.mp3',
    50,
    'active'
),
(
    'avatar',
    'jonathan-demo',
    'jonathan_breath_deep.mp3',
    'breath',
    'deep',
    ARRAY[]::TEXT[],
    220,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_breath_deep.mp3',
    45,
    'active'
),
-- Affirmation expressions
(
    'avatar',
    'jonathan-demo',
    'jonathan_affirmation_confident.mp3',
    'affirmation',
    'confident',
    ARRAY['exactly', 'absolutely', 'definitely', 'yes', 'correct'],
    160,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_affirmation_confident.mp3',
    65,
    'active'
),
(
    'avatar',
    'jonathan-demo',
    'jonathan_affirmation_agreeable.mp3',
    'affirmation',
    'agreeable',
    ARRAY['right', 'agreed', 'precisely'],
    140,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_affirmation_agreeable.mp3',
    60,
    'active'
),
-- Greeting expressions
(
    'avatar',
    'jonathan-demo',
    'jonathan_greeting_warm.mp3',
    'greeting',
    'warm',
    ARRAY['hello', 'hi', 'hey', 'welcome'],
    180,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_greeting_warm.mp3',
    70,
    'active'
),
(
    'avatar',
    'jonathan-demo',
    'jonathan_greeting_casual.mp3',
    'greeting',
    'casual',
    ARRAY['good morning', 'good afternoon', 'good evening'],
    200,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_greeting_casual.mp3',
    65,
    'active'
),
-- Catchphrase expressions
(
    'avatar',
    'jonathan-demo',
    'jonathan_catchphrase_signature.mp3',
    'catchphrase',
    'signature',
    ARRAY[]::TEXT[],
    300,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_catchphrase_signature.mp3',
    80,
    'active'
),
-- Filler expressions
(
    'avatar',
    'jonathan-demo',
    'jonathan_filler_thoughtful.mp3',
    'filler',
    'thoughtful',
    ARRAY[]::TEXT[],
    120,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_filler_thoughtful.mp3',
    40,
    'active'
),
(
    'avatar',
    'jonathan-demo',
    'jonathan_filler_natural.mp3',
    'filler',
    'natural',
    ARRAY[]::TEXT[],
    100,
    'https://your-cdn.com/avatars/jonathan-demo/jonathan_filler_natural.mp3',
    35,
    'active'
);

-- Verify the expressions were added
SELECT 
    type,
    tone,
    priority,
    filename,
    array_length(placement_hints, 1) as hint_count
FROM public.expression_clips 
WHERE owner_type = 'avatar' AND owner_key = 'jonathan-demo'
ORDER BY type, priority DESC;
-- Test the search_memories function to make sure it works
-- Run this to verify everything is working

-- Test the search function
SELECT 'Testing search_memories function:' as test;
SELECT fragment_text FROM search_memories('jonathan_braden', 'who are you', 3);

-- Test with different queries
SELECT 'Testing with "family":' as test;
SELECT fragment_text FROM search_memories('jonathan_braden', 'family', 2);

-- Test with empty query (should return some results)
SELECT 'Testing with empty query:' as test;
SELECT fragment_text FROM search_memories('jonathan_braden', '', 2);
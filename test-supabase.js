// test-supabase.js
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: 'test-user-' + Date.now(),
      personality: { test: true },
      created_at: new Date().toISOString(),
    })

  console.log('➡️ data:', data)
  console.log('➡️ error:', error)
}

main()

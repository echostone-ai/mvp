#!/usr/bin/env ts-node
import seedAvatarFromProfile from '../src/lib/dev/seedAvatarFromProfile'

async function main() {
  const slug = process.env.AVATAR_SLUG || 'jonathan_braden'
  try {
    const res = await seedAvatarFromProfile(slug)
    console.log(JSON.stringify({ ok: true, slug, ...res }, null, 2))
  } catch (e: any) {
    console.error('Seed failed:', e?.message || e)
    process.exit(1)
  }
}

main()



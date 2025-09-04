'use client'

import { useEffect, useMemo, useState } from 'react'

type Fact = { id: string; key: string; value: string; confidence?: number; priority: number; source?: string; created_at?: string }
type Fragment = { id: string; fragment_text: string; created_at?: string; conversation_context?: any }

export default function MemoriesPage() {
  const [facts, setFacts] = useState<Fact[]>([])
  const [fragments, setFragments] = useState<Fragment[]>([])
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all'|'fact'|'fragment'>('all')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [loading, setLoading] = useState(false)

  const groupedFacts = useMemo(() => {
    const groups: Record<string, Fact[]> = { bio: [], relationships: [], favorites: [], history: [], other: [] }
    for (const f of facts) {
      const k = f.key.toLowerCase()
      const cat = k.includes('birth') || k.includes('name') || k.includes('home') ? 'bio'
        : (k.includes('mother') || k.includes('father') || k.includes('partner') || k.includes('pet') || k.includes('family')) ? 'relationships'
        : (k.includes('favorite') || k.includes('hobby') || k.includes('likes')) ? 'favorites'
        : (k.includes('lived') || k.includes('work') || k.includes('school') || k.includes('year')) ? 'history'
        : 'other'
      groups[cat].push(f)
    }
    return groups
  }, [facts])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (type !== 'all') params.set('type', type)
      if (dateStart) params.set('start', dateStart)
      if (dateEnd) params.set('end', dateEnd)
      const res = await fetch(`/api/memories/list?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setFacts(data.facts || [])
        setFragments(data.fragments || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      <h1 style={{ marginBottom: 10 }}>Memories</h1>
      <p style={{ marginTop: 0, color: '#666' }}>Pinned Facts and Conversation Memories</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
        <select value={type} onChange={e=>setType(e.target.value as any)} style={{ padding: 8 }}>
          <option value="all">All</option>
          <option value="fact">Pinned Facts</option>
          <option value="fragment">Conversation Memories</option>
        </select>
        <input type="date" value={dateStart} onChange={e=>setDateStart(e.target.value)} />
        <input type="date" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} />
        <button onClick={load} disabled={loading} style={{ padding: '8px 12px' }}>{loading ? 'Loading…' : 'Apply'}</button>
      </div>

      {(type === 'all' || type === 'fact') && (
        <section style={{ marginBottom: 24 }}>
          <h2>Pinned Facts</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {Object.entries(groupedFacts).map(([cat, list]) => (
              <div key={cat} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{cat}</div>
                {list.length === 0 && <div style={{ color: '#888' }}>No facts</div>}
                {list.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px dashed #f0f0f0' }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#888' }}>{f.key}</div>
                      <div>{f.value}</div>
                    </div>
                    <button
                      onClick={async () => {
                        const nv = prompt('Update value', f.value)
                        if (nv && nv !== f.value) {
                          await fetch('/api/memories/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ kind: 'fact', id: f.id, avatarId: (f as any).avatar_id, key: f.key, value: nv })
                          })
                          load()
                        }
                      }}
                      style={{ fontSize: 12 }}
                    >Update</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {(type === 'all' || type === 'fragment') && (
        <section>
          <h2>Conversation Memories</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {fragments.map(fr => (
              <div key={fr.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{new Date(fr.created_at || '').toLocaleString()}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{fr.fragment_text}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button 
                    onClick={async () => {
                      const nv = prompt('Edit memory', fr.fragment_text)
                      if (nv && nv !== fr.fragment_text) {
                        await fetch('/api/memories/update', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ kind: 'fragment', id: fr.id, text: nv })
                        })
                        load()
                      }
                    }}
                  >Edit</button>
                  <button onClick={() => alert(JSON.stringify(fr.conversation_context, null, 2))}>Details</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}



'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import styles from './memories.module.css'

type Fact = { id: string; key: string; value: string; priority: number; confidence?: number; source?: string }
type Fragment = { id: string; fragment_text: string; conversation_context?: any; created_at: string }

export default function MemoriesPage() {
  const { slug } = useParams() as { slug: string }
  const [facts, setFacts] = useState<Fact[]>([])
  const [fragments, setFragments] = useState<Fragment[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [toast, setToast] = useState('')
  const [avatarId, setAvatarId] = useState<string>('')

  async function load() {
    setLoading(true)
    // Resolve avatar id by slug
    const prof = await fetch(`/api/avatars/${encodeURIComponent(slug)}/memories?limit=1`).then(r => r.json()).catch(() => null)
    const av = prof?.avatar?.id as string | undefined
    if (!av) { setLoading(false); return }
    setAvatarId(av)
    const params = new URLSearchParams({ avatarId: av, page: String(page), pageSize: '50', q })
    const data = await fetch(`/api/memories/list?${params.toString()}`).then(r => r.json())
    setFacts(data.facts || [])
    let frags: Fragment[] = data.fragments || []
    if (tag) frags = frags.filter((f: any) => (f.conversation_context?.tags || []).includes(tag))
    setFragments(frags)
    setLoading(false)
  }

  useEffect(() => { load() }, [slug, page, q, tag])

  function optimisticToast() {
    setToast('Saved · will reflect in next reply')
    setTimeout(() => setToast(''), 1200)
  }

  async function updateFact(fact: Fact, changes: Partial<Pick<Fact,'value'|'priority'>>) {
    const prev = [...facts]
    setFacts(facts.map(f => f.id === fact.id ? { ...f, ...changes } : f))
    try {
      const body: any = { kind: 'fact', id: fact.id, avatarId, ...changes }
      await fetch('/api/memories/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      optimisticToast()
    } catch {
      setFacts(prev)
    }
  }

  async function archiveFact(fact: Fact) {
    const prev = [...facts]
    setFacts(facts.filter(f => f.id !== fact.id))
    try {
      await fetch('/api/memories/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fact', id: fact.id, avatarId, archive: true }) })
      optimisticToast()
    } catch {
      setFacts(prev)
    }
  }

  async function updateFragment(fr: Fragment, changes: { gist?: string; tags?: string[]; people?: string[]; text?: string }) {
    const prev = [...fragments]
    setFragments(fragments.map(f => f.id === fr.id ? { ...f, fragment_text: changes.text ?? f.fragment_text, conversation_context: { ...(f.conversation_context||{}), ...(changes.gist ? { gist: changes.gist } : {}), ...(changes.tags ? { tags: changes.tags } : {}), ...(changes.people ? { people: changes.people } : {}) } } : f))
    try {
      await fetch('/api/memories/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fragment', id: fr.id, text: changes.text, context: { gist: changes.gist, tags: changes.tags, people: changes.people } }) })
      optimisticToast()
    } catch {
      setFragments(prev)
    }
  }

  function promoteToFact(fr: Fragment) {
    const gist = fr.conversation_context?.gist || fr.fragment_text.slice(0, 120)
    const key = prompt('Fact key', 'life_event')
    const value = prompt('Fact value', gist)
    const pr = Number(prompt('Priority (1-10)', '3') || '3')
    if (!key || !value) return
    fetch('/api/memories/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fact', id: 'new', avatarId, key, value, priority: pr }) })
      .then(() => { optimisticToast(); load() })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Memory Catalog</h1>
        <div className={styles.searchRow}>
          <input className={styles.search} placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
          <input className={styles.search} placeholder="Filter tag…" value={tag} onChange={e => setTag(e.target.value)} />
        </div>
      </div>

      <div className={styles.tabs}>
        <input type="radio" id="tab1" name="tab" defaultChecked />
        <label htmlFor="tab1">Quick Facts</label>
        <input type="radio" id="tab2" name="tab" />
        <label htmlFor="tab2">Fragments</label>
        <div className={styles.panels}>
          <section className={styles.panel}>
            <div className={styles.table}>
              <div className={styles.thead}>
                <div>Key</div><div>Value</div><div>Priority</div><div>Confidence</div><div>Source</div><div></div>
              </div>
              {facts.map(f => (
                <div key={f.id} className={styles.trow}>
                  <div className={styles.key}>{f.key}</div>
                  <div>
                    <input className={styles.cellInput} value={f.value} onChange={e => updateFact(f, { value: e.target.value })} />
                  </div>
                  <div>
                    <input className={styles.cellInput} type="number" min={1} max={10} value={f.priority} onChange={e => updateFact(f, { priority: Number(e.target.value) })} />
                  </div>
                  <div>{(f.confidence ?? 0).toFixed(2)}</div>
                  <div>{f.source || ''}</div>
                  <div><button className={styles.danger} onClick={() => archiveFact(f)}>Archive</button></div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.fragmentList}>
              {fragments.map(fr => (
                <div key={fr.id} className={styles.fragmentCard}>
                  <div className={styles.fragmentTitle}>{(fr.fragment_text || '').split(/\s+/).slice(0, 8).join(' ')}</div>
                  <textarea className={styles.fragmentGist} rows={3} value={fr.conversation_context?.gist || ''} placeholder="Gist"
                    onChange={e => updateFragment(fr, { gist: e.target.value })} />
                  <input className={styles.fragmentTags} placeholder="tags,comma,separated" value={(fr.conversation_context?.tags || []).join(', ')}
                    onChange={e => updateFragment(fr, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                  <div className={styles.fragmentMeta}>
                    <span>{new Date(fr.created_at).toLocaleDateString()}</span>
                    <div className={styles.fragmentActions}>
                      <button className={styles.secondary} onClick={() => promoteToFact(fr)}>Promote to Quick Fact</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {loading && <div className={styles.loading}>Loading…</div>}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}



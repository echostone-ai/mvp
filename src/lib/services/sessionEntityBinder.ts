export type EntityType = 'pet' | 'person' | 'place' | 'thing'

export interface EntityBinding {
  canonical: string
  aliases: string[]
  type: EntityType
  description?: string
}

export type SessionBindings = Record<string, EntityBinding>

export class SessionEntityBinder {
  private bindings: SessionBindings = {}

  getAll(): SessionBindings {
    return this.bindings
  }

  addOrUpdate(binding: EntityBinding) {
    const key = binding.canonical.toLowerCase()
    const deduped = Array.from(new Set([binding.canonical, ...binding.aliases].map(a => a.toLowerCase())))
    this.bindings[key] = {
      canonical: binding.canonical,
      aliases: deduped,
      type: binding.type,
      description: binding.description,
    }
  }

  seedFromQuickFacts(quickFacts: Array<{ key: string; value: string }>) {
    const nameFact = quickFacts.find(f => f.key.includes('pet_name'))
    const typeFact = quickFacts.find(f => f.key.includes('pet_type'))
    if (nameFact) {
      const name = nameFact.value
      const petType = (typeFact?.value || '').toLowerCase()
      const baseAliases = this.inferPetAliases(petType, name)
      this.addOrUpdate({ canonical: name, aliases: baseAliases, type: 'pet', description: petType || undefined })
    }
  }

  seedFromConversation(text: string) {
    const lower = text.toLowerCase()
    // Simple heuristic: if user mentions "my poodle" and we already have a pet name, no-op
    // If user says "romeo", make sure alias exists
    Object.values(this.bindings).forEach(b => {
      if (lower.includes(b.canonical.toLowerCase()) && !b.aliases.includes(b.canonical.toLowerCase())) {
        b.aliases.push(b.canonical.toLowerCase())
      }
    })
  }

  resolveAlias(token: string): string | null {
    const t = token.toLowerCase()
    for (const binding of Object.values(this.bindings)) {
      if (binding.aliases.includes(t) || binding.canonical.toLowerCase() === t) {
        return binding.canonical
      }
    }
    return null
  }

  buildSystemPreface(): string | null {
    const entries = Object.values(this.bindings)
    if (entries.length === 0) return null
    const lines: string[] = ['Within this session, resolve referents as follows:']
    for (const b of entries) {
      const aliasStr = b.aliases.filter(a => a !== b.canonical.toLowerCase()).slice(0, 6).join('/')
      const desc = b.description ? ` (${b.description})` : ''
      if (aliasStr) lines.push(`${aliasStr} ⇒ ${b.canonical}${desc}`)
    }
    lines.push('Do not deny ownership or relationship if a mapping exists. Use the canonical name in your reply when appropriate.')
    return lines.join('\n')
  }

  private inferPetAliases(petType: string, name: string): string[] {
    const aliases = [name.toLowerCase()]
    const tokens: string[] = []
    if (petType.includes('poodle')) tokens.push('poodle')
    if (petType.includes('dog')) tokens.push('dog')
    tokens.push('pup', 'he')
    return Array.from(new Set([...aliases, ...tokens]))
  }
}




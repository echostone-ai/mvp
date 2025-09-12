import React from 'react'

type Fact = { key: string; value: string; confidence?: number }

export function Readback({ facts, clarifiers = [], onSave, onEdit, onSkip }: {
  facts: Fact[]
  clarifiers?: { question: string; reason?: string }[]
  onSave?: () => void
  onEdit?: () => void
  onSkip?: () => void
}) {
  const name = facts.find(f => f.key === 'full_name')?.value || 'Unnamed'
  const hometown = facts.find(f => f.key === 'hometown' || f.key === 'birthplace')?.value
  const birth = facts.find(f => f.key === 'birthdate' || f.key === 'birth_year')?.value
  const notable = facts.find(f => ['pet','service_unit_text','service_role','hobbies'].includes(f.key))?.value

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Summary</strong>
        <p style={{ margin: '4px 0' }}>{name}{hometown ? `, from ${hometown}` : ''}{birth ? `, born ${birth}` : ''}.</p>
        {notable && <p style={{ margin: '4px 0' }}>Notable: {notable}</p>}
      </div>
      {clarifiers[0] && (
        <div style={{ marginBottom: 12 }}>
          <strong>Quick question</strong>
          <p style={{ margin: '4px 0' }}>{clarifiers[0].question}</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSave}>Save</button>
        <button onClick={onEdit}>Edit</button>
        <button onClick={onSkip}>Skip</button>
      </div>
      {/* TODO: Wire save to persist quick_facts (already handled server-side in creation flow) */}
    </div>
  )
}

export default Readback



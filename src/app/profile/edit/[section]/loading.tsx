'use client'
export default function Loading() {
  return (
    <main style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle, #8b5cf6 0%, #4c1d95 40%, #000 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#e0d4f7',
      fontFamily: 'Inter, Arial, sans-serif'
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 32, marginBottom: 30,
        background: 'rgba(170,132,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div className="lds-dual-ring" style={{
          width: 44, height: 44, border: '6px solid #a884ff55', borderTop: '6px solid #a884ff', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
      <div style={{
        fontSize: '1.27rem', fontWeight: 600, letterSpacing: '0.02em', textAlign: 'center', opacity: 0.82
      }}>
        Loading your EchoStone profile section…
      </div>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
      `}</style>
    </main>
  )
}
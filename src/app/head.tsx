// src/app/head.tsx
export default function Head() {
  return (
    <>
      {/* Basic tags */}
      <title>EchoStone — Ask Jonathan</title>
      <meta
        name="description"
        content="Interact with your AI-powered legacy avatar of Jonathan Braden—ask questions by typing or speaking!"
      />
      <link rel="icon" href="/echostone_logo.png" />

      {/* Open Graph for social previews */}
      <meta property="og:title" content="EchoStone — Ask Jonathan" />
      <meta
        property="og:description"
        content="Chat live with Jonathan's AI."
      />
      <meta
        property="og:image"
        content="https://app.echostone.ai/og-image.png"
      />
      <meta property="og:url" content="https://app.echostone.ai" />
      <meta property="og:type" content="website" />
    </>
  )
}

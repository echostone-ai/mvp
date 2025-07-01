'use client'

import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import React from 'react'

// Loads the GLB from your public folder
function AvatarModel() {
  // `useGLTF` will cache and parse the GLB for you
  const { scene } = useGLTF('/avatar/avatar.glb')
  return <primitive object={scene} />
}

export default function AvatarCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 1.5, 3], fov: 45 }}
      style={{ width: '100%', height: '400px' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 7]} intensity={1} />
      <AvatarModel />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={1.2}
      />
    </Canvas>
  )
}

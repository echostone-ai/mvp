'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, PresentationControls, Center, Environment } from '@react-three/drei';

export default function AvatarCanvas() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.6, 3], fov: 45 }}
      style={{ width: '100%', height: '450px' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <PresentationControls
        global
        config={{ mass: 2, tension: 500 }}
        snap
        rotation={[0, 0, 0]}
        polar={[-0.4, Math.PI / 4]}
      >
        <Center>
          <AvatarModel />
        </Center>
      </PresentationControls>
      <Environment preset="city" />
    </Canvas>
  );
}

function AvatarModel() {
  const { scene } = useGLTF('/avatar/avatar.glb');

  scene.traverse((child: any) => {
    if (child.isMesh) {
      // hide arms
      const lname = child.name.toLowerCase();
      if (lname.includes('arm')) {
        child.visible = false;
      } else {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) child.material.roughness = 1;
      }
    }
  });

  // Center on head/torso, scale up slightly
  return <primitive object={scene} scale={1.4} position={[0, -1.3, 0]} />;
}

useGLTF.preload('/avatar/avatar.glb');

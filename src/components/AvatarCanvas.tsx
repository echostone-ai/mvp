/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, PresentationControls, Center, Environment } from '@react-three/drei';

export default function AvatarCanvas() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.6, 3], fov: 45 }}
      style={{ width: '100%', height: '450px', borderRadius: '8px', overflow: 'hidden' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <PresentationControls global rotation={[0, 0, 0]}>

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
      const lname = child.name.toLowerCase();
      // Hide arms
      if (lname.includes('arm')) {
        child.visible = false;
      } else {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) child.material.roughness = 1;
      }
    }
  });

  return <primitive object={scene} scale={1.4} position={[0, -1.3, 0]} />;
}

useGLTF.preload('/avatar/avatar.glb');

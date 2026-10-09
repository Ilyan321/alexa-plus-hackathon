import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

// A mock 3D Bracket component
function Bracket({ status }: { status: 'normal' | 'error' | 'idle' }) {
  const group = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Target color based on status
  const targetColor = useMemo(() => {
    if (status === 'error') return new THREE.Color('#ef4444'); // Red
    if (status === 'normal') return new THREE.Color('#10b981'); // Green
    return new THREE.Color('#94a3b8'); // Slate/Idle
  }, [status]);

  useFrame((state, delta) => {
    if (group.current) {
      // Gentle rotation for showcase
      group.current.rotation.y += delta * 0.2;
    }
    
    // Smoothly interpolate color
    if (materialRef.current) {
      materialRef.current.color.lerp(targetColor, 0.1);
    }
  });

  return (
    <group ref={group} dispose={null}>
      {/* Mock geometry representing an aerospace bracket */}
      {/* Base */}
      <mesh position={[0, -0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 0.5, 3]} />
        <meshStandardMaterial ref={materialRef} roughness={0.3} metalness={0.7} />
      </mesh>
      
      {/* Upper Flange - The part that might fail tolerance */}
      <mesh position={[0, 0.75, -1]} castShadow receiveShadow>
        <boxGeometry args={[2, 2, 0.5]} />
        <meshStandardMaterial roughness={0.3} metalness={0.7} color={targetColor} />
      </mesh>
      
      {/* Side supports */}
      <mesh position={[-1.75, 0.75, 0.25]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 2, 2]} />
        <meshStandardMaterial roughness={0.3} metalness={0.7} color={targetColor} />
      </mesh>
      <mesh position={[1.75, 0.75, 0.25]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 2, 2]} />
        <meshStandardMaterial roughness={0.3} metalness={0.7} color={targetColor} />
      </mesh>
    </group>
  );
}

export default function Scene({ status }: { status: 'normal' | 'error' | 'idle' }) {
  return (
    <Canvas camera={{ position: [5, 4, 6], fov: 45 }} shadows>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow shadow-mapSize={1024} />
      
      <Bracket status={status} />
      
      <ContactShadows position={[0, -0.75, 0]} opacity={0.4} scale={10} blur={2} far={4} />
      <Environment preset="city" />
      <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
    </Canvas>
  );
}

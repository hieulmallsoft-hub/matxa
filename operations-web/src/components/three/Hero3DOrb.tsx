import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Swarm of glowing particles orbiting the core
function ParticleField({ count = 180 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null!);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorCyan = new THREE.Color('#06B6D4');
    const colorViolet = new THREE.Color('#8B5CF6');
    const colorBlue = new THREE.Color('#3B82F6');

    for (let i = 0; i < count; i++) {
      // Spherical distribution around radius 1.8 to 2.8
      const radius = 1.8 + Math.random() * 1.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      const mixedColor =
        Math.random() > 0.5
          ? colorCyan.clone().lerp(colorViolet, Math.random())
          : colorBlue.clone().lerp(colorCyan, Math.random());

      col[i * 3] = mixedColor.r;
      col[i * 3 + 1] = mixedColor.g;
      col[i * 3 + 2] = mixedColor.b;
    }
    return { positions: pos, colors: col };
  }, [count]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.15;
      pointsRef.current.rotation.x += delta * 0.05;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// Interactive Central Holographic Orb with orbiting rings
function InteractiveCore() {
  const groupRef = useRef<THREE.Group>(null!);
  const innerSphereRef = useRef<THREE.Mesh>(null!);
  const outerRingRef = useRef<THREE.Mesh>(null!);
  const secondaryRingRef = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Subtle pointer parallax tracking
    const targetX = state.pointer.x * 0.35;
    const targetY = state.pointer.y * 0.25;

    groupRef.current.rotation.y += (targetX - groupRef.current.rotation.y) * 0.05;
    groupRef.current.rotation.x += (-targetY - groupRef.current.rotation.x) * 0.05;

    // Continuous smooth idle rotations
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += delta * 0.25;
      outerRingRef.current.rotation.x += delta * 0.18;
    }
    if (secondaryRingRef.current) {
      secondaryRingRef.current.rotation.y -= delta * 0.3;
      secondaryRingRef.current.rotation.z -= delta * 0.15;
    }
    if (innerSphereRef.current) {
      innerSphereRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={2.5} rotationIntensity={0.4} floatIntensity={0.6}>
        {/* Core Glowing Distorted Sphere */}
        <mesh ref={innerSphereRef} scale={1.15}>
          <sphereGeometry args={[1, 64, 64]} />
          <MeshDistortMaterial
            color="#2563EB"
            emissive="#1E1B4B"
            emissiveIntensity={0.4}
            roughness={0.15}
            metalness={0.85}
            distort={0.32}
            speed={1.8}
          />
        </mesh>

        {/* Outer Gyroscopic Ring 1 */}
        <mesh ref={outerRingRef} scale={1.65}>
          <torusGeometry args={[1, 0.02, 16, 100]} />
          <meshStandardMaterial
            color="#06B6D4"
            emissive="#0891B2"
            emissiveIntensity={0.8}
            roughness={0.2}
            metalness={0.9}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Outer Gyroscopic Ring 2 */}
        <mesh ref={secondaryRingRef} scale={1.9}>
          <torusGeometry args={[1, 0.015, 16, 100]} />
          <meshStandardMaterial
            color="#8B5CF6"
            emissive="#7C3AED"
            emissiveIntensity={0.9}
            roughness={0.2}
            metalness={0.9}
            transparent
            opacity={0.7}
          />
        </mesh>

        {/* Fine Geodesic Wireframe Halo */}
        <mesh scale={1.38}>
          <icosahedronGeometry args={[1, 2]} />
          <meshBasicMaterial
            color="#60A5FA"
            wireframe
            transparent
            opacity={0.22}
          />
        </mesh>

        {/* Particle Cloud */}
        <ParticleField count={180} />
      </Float>
    </group>
  );
}

export const Hero3DOrb: React.FC = () => {
  return (
    <div className="relative w-full h-[240px] sm:h-[280px] md:h-[320px] flex items-center justify-center pointer-events-auto">
      {/* Subtle background radial glow */}
      <div className="absolute inset-0 bg-radial-gradient from-indigo-500/10 via-cyan-500/5 to-transparent rounded-full filter blur-2xl pointer-events-none" />

      {/* Canvas container */}
      <Canvas
        camera={{ position: [0, 0, 4.6], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        className="cursor-grab active:cursor-grabbing"
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#38BDF8" />
        <pointLight position={[-4, -3, -2]} intensity={1.5} color="#A855F7" />
        <pointLight position={[0, 4, 2]} intensity={0.8} color="#06B6D4" />

        <InteractiveCore />
      </Canvas>

      {/* Floating telemetry label */}
      <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-mono text-cyan-300/80 flex items-center gap-1.5 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span>NEURAL ENGINE • 60 FPS</span>
      </div>
    </div>
  );
};

export default Hero3DOrb;

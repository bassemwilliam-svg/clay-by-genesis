"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { TankStructure } from "./tank-structure";
import type { ConfiguratorParams } from "./types";

const FOV = 42;
const CAP = 0.78; // coned-top height, kept in sync with tank-structure

function Scene({ params }: { params: ConfiguratorParams }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const H = params.overallHeight;

  // Re-fit the camera whenever the tower height changes so the full structure
  // stays framed at any height, without fighting orbit / auto-rotate, which
  // continue from the new distance.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const centerY = (H + CAP) / 2;
    c.target.set(0, centerY, 0);
    const halfFov = (FOV / 2) * (Math.PI / 180);
    const dist = ((H + CAP + 4) / (2 * Math.tan(halfFov))) * 1.1;
    const dir = new THREE.Vector3().subVectors(camera.position, c.target);
    if (dir.lengthSq() === 0) dir.set(0.57, 0.48, 0.67);
    dir.normalize();
    camera.position.copy(c.target).addScaledVector(dir, dist);
    c.update();
  }, [H, camera]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[8, 18, 8]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-10, 6, -8]} intensity={0.5} />
      <TankStructure params={params} />
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.5}
        scale={22}
        blur={2.4}
        far={14}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        minDistance={8}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate
        autoRotateSpeed={0.6}
      />
    </>
  );
}

// Default export so it can be lazily loaded client-only via next/dynamic.
export default function SceneCanvas({ params }: { params: ConfiguratorParams }) {
  return (
    <Canvas shadows camera={{ position: [13, 10.5, 15], fov: FOV }}>
      <color attach="background" args={["#1a1512"]} />
      <Scene params={params} />
    </Canvas>
  );
}

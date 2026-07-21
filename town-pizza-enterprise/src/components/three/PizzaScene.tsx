"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Float, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, DepthOfField, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

/** Deterministic pseudo-random so SSR/CSR match and layout is stable. */
function seeded(i: number) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

type Topping = { pos: [number, number, number]; type: "pepperoni" | "olive" | "basil"; scale: number };

const toppings: Topping[] = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + seeded(i);
  const r = 0.5 + seeded(i * 3) * 1.35;
  const kind = i % 4 === 0 ? "olive" : i % 5 === 0 ? "basil" : "pepperoni";
  return {
    pos: [Math.cos(a) * r, 0.19, Math.sin(a) * r],
    type: kind as Topping["type"],
    scale: 0.8 + seeded(i * 7) * 0.5,
  };
});

function Topping({ t, explode }: { t: Topping; explode: React.RefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  const dir = useMemo(() => new THREE.Vector3(t.pos[0], 0, t.pos[2]).normalize(), [t.pos]);
  useFrame(() => {
    if (!ref.current) return;
    const e = explode.current ?? 0;
    ref.current.position.set(
      t.pos[0] + dir.x * e * 1.4,
      t.pos[1] + e * (0.6 + t.scale),
      t.pos[2] + dir.z * e * 1.4
    );
    ref.current.rotation.y += 0.003;
  });
  return (
    <group ref={ref} position={t.pos} scale={t.scale}>
      {t.type === "pepperoni" && (
        <mesh castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 24]} />
          <meshStandardMaterial color="#b02a1c" roughness={0.6} metalness={0.05} />
        </mesh>
      )}
      {t.type === "olive" && (
        <mesh castShadow>
          <torusGeometry args={[0.12, 0.06, 12, 20]} />
          <meshStandardMaterial color="#241019" roughness={0.4} />
        </mesh>
      )}
      {t.type === "basil" && (
        <mesh castShadow rotation={[Math.PI / 2.4, 0, seeded(t.pos[0]) * 3]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#3f8f37" roughness={0.7} />
        </mesh>
      )}
    </group>
  );
}

function Steam() {
  const pts = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 40;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (seeded(i) - 0.5) * 2.2;
      arr[i * 3 + 1] = seeded(i * 2) * 2.4;
      arr[i * 3 + 2] = (seeded(i * 3) - 0.5) * 2.2;
    }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    if (!pts.current) return;
    const p = pts.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.4;
      if (y > 2.6) y = 0.2;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={pts} geometry={geo} position={[0, 0.3, 0]}>
      <pointsMaterial color="#ffffff" size={0.14} transparent opacity={0.14} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function Pizza({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const explode = useRef(0);
  const { pointer } = useThree();

  useFrame((state, dt) => {
    const s = scrollRef.current ?? 0;
    explode.current = THREE.MathUtils.lerp(explode.current, s, 0.08);
    if (group.current) {
      // cinematic idle rotation + scroll spin + gentle mouse parallax
      group.current.rotation.y += dt * 0.12 + s * dt * 0.6;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        -0.85 + pointer.y * 0.16 + s * 0.25,
        0.05
      );
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, pointer.x * 0.12, 0.05);
      group.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.06;
    }
  });

  return (
    <group ref={group} rotation={[-0.85, 0, 0]}>
      {/* crust */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[2.25, 2.15, 0.34, 64]} />
        <meshStandardMaterial color="#d9963f" roughness={0.85} metalness={0.02} />
      </mesh>
      {/* cheese */}
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <cylinderGeometry args={[2.0, 2.05, 0.08, 64]} />
        <meshStandardMaterial color="#f3c85a" roughness={0.55} metalness={0.04} emissive="#7a4d10" emissiveIntensity={0.12} />
      </mesh>
      {/* sauce peek */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[2.02, 2.02, 0.04, 64]} />
        <meshStandardMaterial color="#a8241a" roughness={0.7} />
      </mesh>
      {toppings.map((t, i) => (
        <Topping key={i} t={t} explode={explode} />
      ))}
      <Steam />
    </group>
  );
}

export function PizzaScene({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  return (
    <>
      <color attach="background" args={["#1c0708"]} />
      <fog attach="fog" args={["#1c0708", 10, 22]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 9, 6]} intensity={3.4} color="#fff0d0" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-5, 3, -4]} intensity={45} color="#e8b53f" distance={22} />
      <pointLight position={[5, 2, 4]} intensity={22} color="#e11b22" distance={18} />
      <pointLight position={[0, 4, 7]} intensity={30} color="#fff4dd" distance={20} />
      <spotLight position={[0, 10, 3]} angle={0.6} penumbra={0.8} intensity={80} color="#ffffff" />

      <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.5}>
        <Pizza scrollRef={scrollRef} />
      </Float>

      {/* orbiting hero ingredients */}
      <Float speed={2} floatIntensity={1.4} position={[3.2, 1.4, 0]}>
        <mesh castShadow><sphereGeometry args={[0.34, 24, 24]} /><meshStandardMaterial color="#d23a2a" roughness={0.5} /></mesh>
      </Float>
      <Float speed={1.7} floatIntensity={1.2} position={[-3.3, -0.6, 1]}>
        <mesh castShadow><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="#f3c85a" roughness={0.5} /></mesh>
      </Float>
      <Float speed={2.3} floatIntensity={1.6} position={[-2.6, 1.8, -1]}>
        <mesh castShadow rotation={[1, 0.5, 0]}><torusGeometry args={[0.22, 0.09, 12, 24]} /><meshStandardMaterial color="#241019" roughness={0.4} /></mesh>
      </Float>

      <ContactShadows position={[0, -1.4, 0]} opacity={0.55} scale={12} blur={2.6} far={4} color="#000000" />

      <EffectComposer>
        <DepthOfField target={[0, 0, 0]} focalLength={0.015} bokehScale={2.5} height={480} />
        <Bloom intensity={0.55} luminanceThreshold={0.6} luminanceSmoothing={0.9} mipmapBlur />
        <Vignette eskil={false} offset={0.35} darkness={0.55} />
      </EffectComposer>
    </>
  );
}

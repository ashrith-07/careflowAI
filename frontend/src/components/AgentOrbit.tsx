import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { MutableRefObject } from "react";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

export interface AgentOrbitProps {
  activeAgent: string | null;
  completedAgents: string[];
}

const AGENT_DEFS = [
  { id: "email_agent", radius: 2.5, speed: 0.3, color: "#FF6B6B", phase: 0 },
  { id: "memory_agent", radius: 3.0, speed: 0.25, color: "#F59E0B", phase: 1.2 },
  { id: "logistics_agent", radius: 2.8, speed: 0.35, color: "#00D4AA", phase: 2.4 },
  { id: "council_agent", radius: 3.5, speed: 0.2, color: "#6C63FF", phase: 3.6 },
] as const;

function brighten(hex: string, completed: boolean): THREE.Color {
  const c = new THREE.Color(hex);
  if (completed) c.lerp(new THREE.Color("#ffffff"), 0.35);
  return c;
}

function OrbitTorus({ radius }: { radius: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.012, 8, 128]} />
      <meshBasicMaterial
        color="#6C63FF"
        transparent
        opacity={0.1}
        depthWrite={false}
      />
    </mesh>
  );
}

function CoreSphere() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 1.8) * 0.045;
    mesh.current.scale.setScalar(s);
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.42, 48, 48]} />
      <meshStandardMaterial
        color="#12082a"
        emissive="#6C63FF"
        emissiveIntensity={1.35}
        metalness={0.85}
        roughness={0.18}
      />
    </mesh>
  );
}

function PulseRing() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    const t = (state.clock.elapsedTime % 2.5) / 2.5;
    const s = 0.55 + t * 0.9;
    mesh.current.scale.setScalar(s);
    const mat = mesh.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.45 * (1 - t);
  });
  return (
    <mesh ref={mesh}>
      <ringGeometry args={[0.48, 0.52, 48]} />
      <meshBasicMaterial
        color="#6C63FF"
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function ParticleField() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const positions = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.018;
    ref.current.rotation.x += dt * 0.006;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        size={0.05}
        color="#8892A4"
        transparent
        opacity={0.5}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function BeamToActive({
  endRef,
}: {
  endRef: MutableRefObject<THREE.Vector3>;
}) {
  const lineObj = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 2.5),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: 0x6c63ff,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Line(geom, mat);
  }, []);

  useFrame(() => {
    lineObj.geometry.setFromPoints([
      new THREE.Vector3(0, 0, 0),
      endRef.current.clone(),
    ]);
    const pos = lineObj.geometry.attributes.position as THREE.BufferAttribute;
    pos.needsUpdate = true;
  });

  return <primitive object={lineObj} />;
}

function AgentNodes({
  activeAgent,
  completedAgents,
  endRef,
}: AgentOrbitProps & {
  endRef: MutableRefObject<THREE.Vector3>;
}) {
  const group = useRef<THREE.Group>(null);
  const positions = useRef(
    AGENT_DEFS.map(() => new THREE.Vector3(2.5, 0, 0)),
  );
  const meshes = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    let activePos: THREE.Vector3 | null = null;
    AGENT_DEFS.forEach((cfg, i) => {
      const ang = t * cfg.speed + cfg.phase;
      const x = Math.cos(ang) * cfg.radius;
      const z = Math.sin(ang) * cfg.radius;
      const y = Math.sin(ang * 0.35) * 0.22;
      positions.current[i].set(x, y, z);
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.position.copy(positions.current[i]);
      const active = activeAgent === cfg.id;
      const done = completedAgents.includes(cfg.id);
      const base = brighten(cfg.color, done);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(base);
      mat.emissive.copy(base);
      const pulse = active ? 0.35 * Math.sin(t * 4) : 0;
      mat.emissiveIntensity = (active ? 1.8 : done ? 1.15 : 0.65) + pulse;
      const sc = active ? 1.42 : done ? 1.08 : 1;
      mesh.scale.setScalar(sc);
      if (active) activePos = positions.current[i];
    });
    if (activePos) endRef.current.copy(activePos);
  });

  return (
    <group ref={group}>
      {AGENT_DEFS.map((cfg, i) => (
        <mesh
          key={cfg.id}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.16, 24, 24]} />
          <meshStandardMaterial
            color={cfg.color}
            emissive={cfg.color}
            emissiveIntensity={0.7}
            metalness={0.4}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

function SceneContent(props: AgentOrbitProps) {
  const sceneSpin = useRef<THREE.Group>(null);
  const beamEnd = useRef(new THREE.Vector3(2.5, 0, 0));

  useFrame((_, dt) => {
    if (sceneSpin.current) sceneSpin.current.rotation.y += dt * 0.12;
  });

  const uniqueRadii = useMemo(
    () => [...new Set(AGENT_DEFS.map((d) => d.radius))],
    [],
  );

  const showBeam =
    Boolean(props.activeAgent) &&
    AGENT_DEFS.some((d) => d.id === props.activeAgent);

  return (
    <>
      <color attach="background" args={["#050B18"]} />
      <ambientLight intensity={0.22} />
      <pointLight position={[4, 6, 4]} intensity={1.1} color="#6C63FF" />
      <pointLight position={[-5, 2, -4]} intensity={0.55} color="#00D4AA" />
      <directionalLight position={[0, 10, 6]} intensity={0.35} color="#F0F4FF" />

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.5}
        enableZoom={false}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={Math.PI / 4.5}
        target={[0, 0.12, 0]}
      />

      {/* Slight world lift so the orbit reads visually centered in the frame */}
      <group ref={sceneSpin} position={[0, 0.28, 0]}>
        {uniqueRadii.map((r) => (
          <OrbitTorus key={r} radius={r} />
        ))}
        <CoreSphere />
        <PulseRing />
        <ParticleField />
        <AgentNodes {...props} endRef={beamEnd} />
        {showBeam ? <BeamToActive endRef={beamEnd} /> : null}
      </group>
    </>
  );
}

export function AgentOrbit({ activeAgent, completedAgents }: AgentOrbitProps) {
  return (
    <div className="glass-card glow-purple relative h-full min-h-0 w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-[rgba(5,11,24,0.55)]" />
      <Canvas
        className="block h-full w-full min-h-0"
        camera={{ position: [0, 3.55, 8.6], fov: 40, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneContent
            activeAgent={activeAgent}
            completedAgents={completedAgents}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

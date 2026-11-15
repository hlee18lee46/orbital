'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Sky } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type World = { id: string; name: string; gravity: number; ground: string; sky: string; description: string }
const WORLDS: World[] = [
  { id: 'earth', name: 'Earth', gravity: 9.81, ground: '#527a45', sky: '#79bce9', description: 'Green hills and familiar gravity' },
  { id: 'moon', name: 'Moon', gravity: 1.62, ground: '#898a90', sky: '#060913', description: 'Craters, starlight, and giant leaps' },
  { id: 'mars', name: 'Mars', gravity: 3.71, ground: '#a85a3a', sky: '#b66b52', description: 'Rust-colored dunes and thin air' },
  { id: 'europa', name: 'Europa', gravity: 1.31, ground: '#b6d4df', sky: '#080e20', description: 'Frozen plains beneath Jupiter' },
  { id: 'titan', name: 'Titan', gravity: 1.35, ground: '#9d7445', sky: '#ad713d', description: 'Orange haze and methane lakes' },
]
const SPEED = 5.2
const JUMP_SPEED = 5.5
const PLAYER_HEIGHT = 1.65
const GROUND_Y = 0

type Controls = { forward: boolean; backward: boolean; left: boolean; right: boolean; jump: boolean }
const emptyControls = (): Controls => ({ forward: false, backward: false, left: false, right: false, jump: false })

function Landscape({ world }: { world: World }) {
  const features = useMemo(() => Array.from({ length: 100 }, (_, i) => {
    const a = i * 2.39996
    const r = 5 + Math.sqrt(i / 100) * 65
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, scale: 0.5 + ((i * 17) % 13) / 10, rotation: i * 1.3 }
  }), [])
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[220, 220]} />
      <meshStandardMaterial color={world.ground} roughness={1} />
    </mesh>
    {features.map((f, i) => {
      if (world.id === 'earth') return <group key={i} position={[f.x, 0, f.z]}>
        <mesh position={[0, f.scale * 0.65, 0]} castShadow><coneGeometry args={[f.scale * 0.55, f.scale * 1.3, 7]} /><meshStandardMaterial color={i % 3 === 0 ? '#386e38' : '#487b42'} /></mesh>
        <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.1, 0.15, 0.56, 6]} /><meshStandardMaterial color="#604832" /></mesh>
      </group>
      if (world.id === 'europa') return <mesh key={i} position={[f.x, 0.15, f.z]} rotation={[0, f.rotation, 0]} castShadow><boxGeometry args={[f.scale * 2.1, 0.3, 0.11]} /><meshStandardMaterial color={i % 3 === 0 ? '#5e9cb5' : '#d5e9f0'} /></mesh>
      if (world.id === 'titan' && i % 5 === 0) return <mesh key={i} position={[f.x, 0.025, f.z]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[f.scale * 2.3, 24]} /><meshStandardMaterial color="#384e54" roughness={0.24} /></mesh>
      return <mesh key={i} position={[f.x, f.scale * 0.22, f.z]} rotation={[0, f.rotation, 0]} castShadow>
        {world.id === 'mars' ? <dodecahedronGeometry args={[f.scale * 0.55, 0]} /> : <sphereGeometry args={[f.scale * 0.6, 12, 8]} />}
        <meshStandardMaterial color={world.id === 'moon' ? (i % 2 ? '#6f7179' : '#a6a7ac') : world.id === 'mars' ? (i % 2 ? '#783e2f' : '#c27850') : '#7c8b8e'} roughness={1} />
      </mesh>
    })}
    {world.id === 'europa' && <mesh position={[-28, 19, -65]}><sphereGeometry args={[13, 48, 32]} /><meshStandardMaterial color="#bb9779" roughness={1} /></mesh>}
    {world.id === 'moon' && <mesh position={[-30, 17, -65]}><sphereGeometry args={[8, 48, 32]} /><meshStandardMaterial color="#408ac0" /></mesh>}
    {world.id === 'titan' && <mesh position={[-25, 23, -85]}><sphereGeometry args={[15, 48, 32]} /><meshStandardMaterial color="#c5a66e" /></mesh>}
  </>
}

function Astronaut({ position, facing }: { position: React.RefObject<THREE.Group | null>; facing: React.RefObject<number> }) {
  useFrame(() => { if (position.current) position.current.rotation.y = facing.current })
  return <group ref={position} position={[0, 0, 0]}>
    <mesh position={[0, 0.87, 0]} castShadow><capsuleGeometry args={[0.29, 0.55, 8, 16]} /><meshStandardMaterial color="#f4f1e9" /></mesh>
    <mesh position={[0, 1.43, 0]} castShadow><sphereGeometry args={[0.32, 24, 16]} /><meshStandardMaterial color="#e8e9e7" /></mesh>
    <mesh position={[0, 1.44, 0.245]}><sphereGeometry args={[0.245, 24, 16]} /><meshStandardMaterial color="#1d415a" metalness={0.45} roughness={0.2} /></mesh>
    <mesh position={[0, 0.89, -0.35]} castShadow><boxGeometry args={[0.48, 0.65, 0.26]} /><meshStandardMaterial color="#a8b4be" /></mesh>
    {[-1, 1].map(s => <group key={s}>
      <mesh position={[s * 0.42, 0.88, 0]} rotation={[0, 0, s * 0.15]} castShadow><capsuleGeometry args={[0.12, 0.45, 5, 10]} /><meshStandardMaterial color="#e9e7e1" /></mesh>
      <mesh position={[s * 0.17, 0.34, 0]} castShadow><capsuleGeometry args={[0.14, 0.45, 5, 10]} /><meshStandardMaterial color="#e0dfda" /></mesh>
    </group>)}
  </group>
}

function GameScene({ world, controls, onTelemetry, resetKey }: { world: World; controls: React.RefObject<Controls>; onTelemetry: (height: number, grounded: boolean) => void; resetKey: number }) {
  const player = useRef<THREE.Group>(null)
  const facing = useRef(0)
  const pos = useRef(new THREE.Vector3(0, 0, 0))
  const velocity = useRef(0)
  const jumpHeld = useRef(false)
  const telemetryTimer = useRef(0)
  const { camera } = useThree()
  useEffect(() => { pos.current.set(0, 0, 0); velocity.current = 0; jumpHeld.current = false; onTelemetry(0, true) }, [world.id, resetKey, onTelemetry])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.04)
    const c = controls.current
    const dir = new THREE.Vector3(Number(c.right) - Number(c.left), 0, Number(c.backward) - Number(c.forward))
    if (dir.lengthSq() > 0) {
      dir.normalize()
      pos.current.addScaledVector(dir, SPEED * dt)
      facing.current = Math.atan2(dir.x, dir.z)
    }
    pos.current.x = THREE.MathUtils.clamp(pos.current.x, -95, 95)
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, -95, 95)
    const grounded = pos.current.y <= GROUND_Y + 0.0001
    if (c.jump && !jumpHeld.current && grounded) velocity.current = JUMP_SPEED
    jumpHeld.current = c.jump
    velocity.current -= world.gravity * dt
    pos.current.y += velocity.current * dt
    if (pos.current.y < GROUND_Y) { pos.current.y = GROUND_Y; velocity.current = 0 }
    if (player.current) player.current.position.copy(pos.current)
    const targetCamera = new THREE.Vector3(pos.current.x, pos.current.y + 4.0, pos.current.z + 9)
    camera.position.lerp(targetCamera, 1 - Math.exp(-5 * dt))
    camera.lookAt(pos.current.x, pos.current.y + PLAYER_HEIGHT * 0.6, pos.current.z)
    telemetryTimer.current += dt
    if (telemetryTimer.current > 0.08) { telemetryTimer.current = 0; onTelemetry(pos.current.y, pos.current.y === GROUND_Y) }
  })
  return <>
    <color attach="background" args={[world.sky]} />
    <fog attach="fog" args={[world.sky, world.id === 'titan' ? 14 : 45, world.id === 'titan' ? 85 : 130]} />
    {world.id === 'earth' ? <Sky sunPosition={[20, 12, -20]} turbidity={3} rayleigh={1.5} /> : world.id === 'mars' || world.id === 'titan' ? null : <Stars radius={90} depth={50} count={2500} factor={4} fade />}
    <ambientLight intensity={world.id === 'moon' ? 0.7 : 1.2} />
    <directionalLight position={[15, 25, 10]} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} />
    <Landscape world={world} />
    <Astronaut position={player} facing={facing} />
  </>
}

export default function GravityExplorerGame() {
  const [selected, setSelected] = useState('earth')
  const [height, setHeight] = useState(0)
  const [grounded, setGrounded] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const controls = useRef<Controls>(emptyControls())
  const world = WORLDS.find(w => w.id === selected)!
  useEffect(() => {
    const map: Record<string, keyof Controls> = { w: 'forward', arrowup: 'forward', s: 'backward', arrowdown: 'backward', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', ' ': 'jump' }
    const handle = (e: KeyboardEvent, pressed: boolean) => {
      const control = map[e.key.toLowerCase()]
      if (control) { e.preventDefault(); controls.current[control] = pressed }
    }
    const down = (e: KeyboardEvent) => handle(e, true)
    const up = (e: KeyboardEvent) => handle(e, false)
    const blur = () => { controls.current = emptyControls() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [])
  const telemetry = useMemo(() => (h: number, g: boolean) => { setHeight(h); setGrounded(g) }, [])
  const switchWorld = (id: string) => { controls.current = emptyControls(); setSelected(id); setHeight(0); setGrounded(true); setResetKey(v => v + 1) }
  return <main style={{ position: 'relative', height: '100dvh', width: '100%', overflow: 'hidden', background: '#080d17', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
    <Suspense fallback={<div style={{ padding: 30 }}>Loading world…</div>}>
      <Canvas key={world.id} shadows camera={{ position: [0, 4, 9], fov: 65 }} dpr={[1, 1.7]}>
        <GameScene world={world} controls={controls} onTelemetry={telemetry} resetKey={resetKey} />
      </Canvas>
    </Suspense>
    <div style={{ position: 'absolute', top: 20, left: 20, maxWidth: 330, padding: 18, background: '#0c1423dd', borderRadius: 14, border: '1px solid #ffffff22' }}>
      <div style={{ fontSize: 12, letterSpacing: 2, color: '#9fc9ff' }}>GRAVITY EXPLORER</div>
      <h1 style={{ fontSize: 28, margin: '8px 0' }}>{world.name}</h1>
      <p style={{ margin: '0 0 14px', color: '#cad3e2' }}>{world.description}</p>
      <div>Gravity: <strong>{world.gravity.toFixed(2)} m/s²</strong></div>
      <div>Height: <strong>{height.toFixed(2)} m</strong></div>
      <div>Status: <strong>{grounded ? 'Grounded' : 'Airborne'}</strong></div>
      <div style={{ fontSize: 12, color: '#b4c5d8', marginTop: 12 }}>WASD / arrows to move · Space to jump</div>
      <button onClick={() => setResetKey(v => v + 1)} style={{ marginTop: 12, padding: '8px 12px', cursor: 'pointer', borderRadius: 8 }}>Reset position</button>
    </div>
    <div style={{ position: 'absolute', right: 20, top: 20, display: 'flex', flexDirection: 'column', gap: 8, background: '#0c1423dd', padding: 12, borderRadius: 14 }}>
      {WORLDS.map(w => <button key={w.id} onClick={() => switchWorld(w.id)} style={{ background: selected === w.id ? '#3074b9' : '#243147', color: '#fff', border: '1px solid #ffffff30', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>{w.name} · {w.gravity} m/s²</button>)}
    </div>
    <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
      {([['◀', 'left'], ['▲', 'forward'], ['▼', 'backward'], ['▶', 'right'], ['JUMP', 'jump']] as const).map(([label, control]) => <button key={control} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); controls.current[control] = true }} onPointerUp={() => { controls.current[control] = false }} onPointerCancel={() => { controls.current[control] = false }} onLostPointerCapture={() => { controls.current[control] = false }} style={{ touchAction: 'none', padding: '13px 15px', background: '#15233cdd', color: 'white', border: '1px solid #ffffff44', borderRadius: 10, cursor: 'pointer', userSelect: 'none' }}>{label}</button>)}
    </div>
  </main>
}

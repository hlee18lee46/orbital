'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Float, Sparkles } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Compass, Expand, Gauge, Globe2, Orbit, Rocket, Sparkles as SparkleIcon, Wallet, Zap } from 'lucide-react'
import { useRouter } from "next/navigation";

type World = { name: string; type: string; gravity: number; color: string; accent: string; terrain: string; description: string; radius: string }
const WORLDS: World[] = [
  { name: 'Earth', type: 'Terrestrial planet', gravity: 9.81, color: '#3f91df', accent: '#91d7ff', terrain: '#567348', description: 'The pale blue dot we call home.', radius: '6,371 km' },
  { name: 'Moon', type: 'Natural satellite', gravity: 1.62, color: '#999da8', accent: '#d7d8df', terrain: '#797b82', description: 'One small step. One giant leap.', radius: '1,737 km' },
  { name: 'Mars', type: 'Terrestrial planet', gravity: 3.71, color: '#c56f4d', accent: '#f0aa73', terrain: '#98573e', description: 'A dusty world on the edge of possibility.', radius: '3,389 km' },
  { name: 'Europa', type: 'Moon of Jupiter', gravity: 1.31, color: '#b7a77f', accent: '#f2dfb6', terrain: '#8b7e69', description: 'An ocean world beneath an icy shell.', radius: '1,561 km' },
  { name: 'Titan', type: 'Moon of Saturn', gravity: 1.35, color: '#cb8f4c', accent: '#f4c27d', terrain: '#86613e', description: 'A hazy moon with rivers of methane.', radius: '2,575 km' },
]

function Planet({ world }: { world: World }) {
  const group = useRef<THREE.Group>(null)
  const material = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = world.color; ctx.fillRect(0, 0, 512, 256)
    let seed = world.name.split('').reduce((a, c) => a + c.charCodeAt(0), 12)
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
    for (let i = 0; i < 100; i++) {
      const x = random() * 512, y = random() * 256, w = 12 + random() * 100, h = 4 + random() * 28
      ctx.fillStyle = i % 2 ? `${world.terrain}99` : `${world.accent}66`
      ctx.beginPath(); ctx.ellipse(x, y, w, h, random() * 2, 0, Math.PI * 2); ctx.fill()
    }
    const texture = new THREE.CanvasTexture(canvas)
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92 })
    return mat
  }, [world])
  useFrame((_, delta) => { if (group.current) group.current.rotation.y += delta * 0.035 })
  return <group ref={group} position={[0, 0.35, -1.55]}><Float speed={0.35} rotationIntensity={0.015} floatIntensity={0.06}><mesh material={material}><sphereGeometry args={[1.72, 64, 64]} /></mesh><mesh><sphereGeometry args={[1.77, 64, 64]} /><meshBasicMaterial color={world.accent} transparent opacity={0.1} side={THREE.BackSide} /></mesh></Float></group>
}

function Ground({ world }: { world: World }) {
  const rocks = useMemo(() => Array.from({ length: 35 }, (_, i) => ({ x: Math.sin(i * 37.1) * 8, z: -2 - (i * 1.73) % 18, scale: 0.08 + ((i * 19) % 12) / 100 })), [])
  return <group><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]} receiveShadow><planeGeometry args={[120, 120]} /><meshStandardMaterial color={world.terrain} roughness={1} /></mesh>{rocks.map((r, i) => <mesh key={i} position={[r.x, -0.57 + r.scale * 0.2, r.z]} rotation={[0.2 * i, i * 0.3, 0]} castShadow><dodecahedronGeometry args={[r.scale, 0]} /><meshStandardMaterial color={world.color} roughness={1} /></mesh>)}</group>
}

function Astronaut({ world, jumping, setJumping, keys }: { world: World; jumping: boolean; setJumping: (v: boolean) => void; keys: Set<string> }) {
  const group = useRef<THREE.Group>(null)
  const velocity = useRef(0)
  const position = useRef(new THREE.Vector3(0, -0.4, 2.3))
  useFrame((_, delta) => {
    if (!group.current) return
    const dt = Math.min(delta, 0.04)
    velocity.current -= world.gravity * 0.34 * dt
    position.current.y += velocity.current * dt
    if (position.current.y <= -0.4) { position.current.y = -0.4; velocity.current = 0; if (jumping) setJumping(false) }
    const speed = dt * 2.4
    if (keys.has('arrowleft') || keys.has('a')) position.current.x -= speed
    if (keys.has('arrowright') || keys.has('d')) position.current.x += speed
    if (keys.has('arrowup') || keys.has('w')) position.current.z -= speed
    if (keys.has('arrowdown') || keys.has('s')) position.current.z += speed
    position.current.x = THREE.MathUtils.clamp(position.current.x, -4, 4)
    position.current.z = THREE.MathUtils.clamp(position.current.z, 1.2, 5)
    group.current.position.copy(position.current)
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, keys.has('a') || keys.has('arrowleft') ? 0.1 : keys.has('d') || keys.has('arrowright') ? -0.1 : 0, 7, dt)
  })
  useEffect(() => { if (jumping && position.current.y <= -0.4 + 0.02) velocity.current = 5.5 }, [jumping])
  return <group ref={group} position={[0, -0.4, 2.3]}><mesh position={[0, 0.23, 0]} castShadow><capsuleGeometry args={[0.22, 0.48, 5, 12]} /><meshStandardMaterial color="#eee9df" roughness={0.65} /></mesh><mesh position={[0, 0.68, 0.03]} castShadow><sphereGeometry args={[0.23, 24, 18]} /><meshStandardMaterial color="#f1eee8" roughness={0.3} /></mesh><mesh position={[0, 0.69, 0.21]}><sphereGeometry args={[0.145, 24, 16]} /><meshStandardMaterial color="#39536a" metalness={0.45} roughness={0.2} /></mesh>{[-1, 1].map((side) => <group key={side} position={[side * 0.29, 0.18, 0]}><mesh rotation={[0, 0, side * -0.18]} castShadow><capsuleGeometry args={[0.085, 0.3, 4, 8]} /><meshStandardMaterial color="#dedbd3" /></mesh></group>)}{[-1, 1].map((side) => <mesh key={side} position={[side * 0.12, -0.17, 0.02]} castShadow><capsuleGeometry args={[0.095, 0.28, 4, 8]} /><meshStandardMaterial color="#d6d0c5" /></mesh>)}</group>
}

function WorldScene({ world, jumping, setJumping, keys }: { world: World; jumping: boolean; setJumping: (v: boolean) => void; keys: Set<string> }) {
  return <Canvas camera={{ position: [0, 2.5, 8.5], fov: 47 }} shadows dpr={[1, 1.6]} gl={{ antialias: true, alpha: false }}><color attach="background" args={['#080d17']} /><fog attach="fog" args={['#080d17', 13, 35]} /><ambientLight intensity={1.2} /><directionalLight position={[-3, 7, 4]} intensity={3.2} castShadow shadow-mapSize={[1024, 1024]} /><pointLight position={[4, 2, -4]} intensity={16} color={world.accent} /><Stars radius={70} depth={45} count={1800} factor={3} saturation={0.25} fade speed={0.2} /><Sparkles count={80} scale={[16, 8, 18]} size={1.7} speed={0.12} opacity={0.35} color="#c9d9ff" /><Planet world={world} /><Ground world={world} /><Astronaut world={world} jumping={jumping} setJumping={setJumping} keys={keys} /></Canvas>
}

function WalletConnect({ wallet, onConnect }: { wallet: string; onConnect: () => void }) {
  return <button className={`wallet-button ${wallet ? 'connected' : ''}`} onClick={onConnect}><span className="wallet-dot" />{wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : 'Connect wallet'}<Wallet size={15} strokeWidth={1.8} /></button>
}

function SceneFallback({ world }: { world: World }) {
  return <div className="scene-fallback" aria-hidden="true"><div className="fallback-stars" /><div className="fallback-planet" style={{ '--world': world.color, '--accent': world.accent, '--terrain': world.terrain } as React.CSSProperties} /><div className="fallback-ground" /><div className="fallback-astronaut"><span className="astronaut-pack" /><span className="astronaut-helmet" /><span className="astronaut-body" /><span className="astronaut-legs" /></div></div>
}

export function GravityExplorer() {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null)
  const [world, setWorld] = useState(WORLDS[0])
  const [wallet, setWallet] = useState('')
  const [jumping, setJumping] = useState(false)
  const [keys] = useState(() => new Set<string>())
  const [notice, setNotice] = useState('')
  const [worldMenu, setWorldMenu] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const router = useRouter();
  useEffect(() => { const timer = window.setInterval(() => setElapsed(v => v + 1), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    try {
      const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: false })
      renderer.dispose()
      setWebglAvailable(true)
    } catch {
      setWebglAvailable(false)
    }
  }, [])
  useEffect(() => {
    const down = (e: KeyboardEvent) => { const key = e.key.toLowerCase(); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault(); keys.add(key); if (key === ' ' && !jumping) setJumping(true) }
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [keys, jumping])
  const connect = useCallback(async () => {
    const provider = (window as Window & { solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }> } }).solana
    if (!provider?.isPhantom) { setNotice('Phantom not found — install the Phantom browser extension to connect.'); return }
    try { const result = await provider.connect(); setWallet(result.publicKey.toString()); setNotice('Wallet connected. Your on-chain identity is ready for exploration.') } catch { setNotice('Wallet connection was cancelled.') }
  }, [])
  const jumpHeight = useMemo(() => (5.5 ** 2) / (2 * world.gravity * 0.34), [world])
  const jump = () => {
  router.push(`/play?world=${world.name.toLowerCase()}`);
};
  return <main className="explorer-shell" style={{ '--planet-accent': world.accent } as React.CSSProperties}>
    <div className="scene-wrap" aria-label={`Interactive 3D ${world.name} surface`}>{webglAvailable === null ? <div className="scene-loading">Preparing your landing site…</div> : webglAvailable ? <Suspense fallback={<div className="scene-loading">Preparing your landing site…</div>}><WorldScene world={world} jumping={jumping} setJumping={setJumping} keys={keys} /></Suspense> : <SceneFallback world={world} />}</div>
    <div className="scene-vignette" />
    <header className="topbar"><a className="brand" href="#home" aria-label="Gravity home"><span className="brand-mark"><Orbit size={19} /></span><span>ORBITAL<span className="brand-light"> / FIELD NOTES</span></span></a><div className="topbar-right"><div className="live-label"><span />LIVE SIMULATION</div><WalletConnect wallet={wallet} onConnect={connect} /></div></header>
    <section className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" />FIELD STUDY 00{WORLDS.indexOf(world) + 1}</div><h1>Feel the pull<br />of <em>{world.name}.</em></h1><p>{world.description}</p><button className="jump-button" onClick={jump}><span className="jump-icon"><Zap size={17} fill="currentColor" /></span><span>Jump into {world.name}<small>SPACEBAR TO JUMP</small></span><ArrowRight size={17} /></button></section>
    <div className="data-chip orbit-chip"><span className="chip-icon"><Gauge size={16} /></span><div><span className="chip-label">SURFACE GRAVITY</span><strong>{world.gravity.toFixed(2)} <small>m/s²</small></strong></div><span className="gravity-index">{(world.gravity / 9.81 * 100).toFixed(0)}<small>%</small></span></div>
    <div className="data-chip height-chip"><span className="chip-icon"><Expand size={16} /></span><div><span className="chip-label">JUMP HEIGHT</span><strong>{jumpHeight.toFixed(1)} <small>m</small></strong></div></div>
    <div className="data-chip radius-chip"><span className="chip-icon"><Globe2 size={16} /></span><div><span className="chip-label">MEAN RADIUS</span><strong>{world.radius}</strong></div></div>
    <section className="world-picker"><div className="picker-heading"><span>DESTINATIONS</span><span className="world-count">{String(WORLDS.length).padStart(2, '0')} WORLDS</span></div><div className="world-list">{WORLDS.map((item, index) => <button key={item.name} onClick={() => { setWorld(item); setJumping(false); setWorldMenu(false) }} className={`world-option ${world.name === item.name ? 'active' : ''}`} aria-pressed={world.name === item.name}><span className="world-thumb" style={{ '--world': item.color, '--accent': item.accent } as React.CSSProperties}><span /></span><span className="world-name">{item.name}<small>{item.type}</small></span><span className="world-gravity">{item.gravity.toFixed(2)}<small>m/s²</small></span>{world.name === item.name && <span className="selected-indicator" />}</button>)}</div><button className="mobile-world-select" onClick={() => setWorldMenu(!worldMenu)}><span className="world-thumb" style={{ '--world': world.color, '--accent': world.accent } as React.CSSProperties}><span /></span>{world.name}<ChevronDown size={15} /></button>{worldMenu && <div className="mobile-world-menu">{WORLDS.map(item => <button key={item.name} onClick={() => { setWorld(item); setWorldMenu(false) }}>{item.name}<small>{item.gravity.toFixed(2)} m/s²</small></button>)}</div>}</section>
    <footer className="bottom-bar"><div className="controls-hint"><span className="hint-label">MOVE</span><span className="keycap"><ArrowUp size={11} /></span><span className="keycap"><ArrowLeft size={11} /></span><span className="keycap"><ArrowDown size={11} /></span><span className="keycap"><ArrowRight size={11} /></span><span className="hint-divider" /><span className="hint-label">JUMP</span><span className="keycap space-key">SPACE</span></div><div className="session-status"><span className="status-dot" />EXPLORATION ACTIVE <span className="status-divider">/</span> {Math.floor(elapsed / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}</div><div className="simulation-note"><Rocket size={14} /> SIMULATED GRAVITY <span className="note-divider">·</span> <SparkleIcon size={13} /> SOLANA READY</div></footer>
    {notice && <div className="toast" role="status"><span className="toast-dot" />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    <div className="crosshair" aria-hidden="true"><span /><span /></div>
  </main>
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flame, X, Play, RotateCcw, Database, ExternalLink } from 'lucide-react'

export type MeteorSettings = { diameter: number; speed: number; angle: number }
export type MeteorFlight = MeteorSettings & { id: number }
type Fireball = { date: string; impactEnergyKt: number; altitudeKm: number | null; latitude: number | null; longitude: number | null }

export function MeteorAnimation({ flight, gravity, onImpact }: { flight: MeteorFlight | null; gravity: number; onImpact: () => void }) {
  const meteor = useMemo(() => new THREE.Group(), [])
  const flash = useMemo(() => new THREE.Group(), [])
  const clock = useMemo(() => ({ elapsed: 0, completed: false }), [])
  const [impact, setImpact] = useState(false)
  useEffect(() => {
    clock.elapsed = 0; clock.completed = false; setImpact(false)
  }, [flight?.id, clock])
  useFrame((_, delta) => {
    if (!flight) { meteor.visible = false; flash.visible = false; return }
    clock.elapsed += Math.min(delta, 0.05)
    // Visual time and distance are compressed; speed and gravity influence duration.
    const duration = THREE.MathUtils.clamp(2.7 * (20 / flight.speed) ** 0.35 * (9.81 / gravity) ** 0.08, 0.8, 4.5)
    const t = Math.min(clock.elapsed / duration, 1)
    const angle = THREE.MathUtils.degToRad(flight.angle)
    const horizontal = 13 / Math.tan(angle)
    meteor.visible = t < 1
    meteor.position.set(-horizontal * (1 - t), 12 * (1 - t) ** 1.35 + 0.5, -13)
    meteor.scale.setScalar(0.35 + Math.min(flight.diameter, 50) / 30)
    flash.visible = t >= 1 && clock.elapsed < duration + 1.2
    flash.position.set(0, 0.22, -13)
    const pulse = Math.max(0, 1 - (clock.elapsed - duration) / 1.2)
    flash.scale.setScalar(0.1 + (1 - pulse) * 7)
    if (t >= 1 && !clock.completed) {
      clock.completed = true
      setImpact(true)
      onImpact()
    }
  })
  return <>
    <primitive object={meteor}>
      <mesh castShadow><icosahedronGeometry args={[0.85, 1]} /><meshStandardMaterial color="#49352c" emissive="#ff5b0b" emissiveIntensity={1.3}/></mesh>
      <pointLight color="#ff7436" intensity={12} distance={15}/>
      <mesh position={[0.8, 0.5, 0]} rotation={[0, 0, -0.5]}><coneGeometry args={[0.7, 3.2, 12]} /><meshBasicMaterial color="#ff9d30" transparent opacity={0.55} depthWrite={false}/></mesh>
    </primitive>
    <primitive object={flash}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.65, 1, 48]} /><meshBasicMaterial color="#ffb84b" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false}/></mesh>
      <pointLight color="#ff8b36" intensity={impact ? 8 : 0} distance={16}/>
    </primitive>
  </>
}

export default function MeteorLab({ worldName, gravity, onLaunch, onClose, impacted }: { worldName: string; gravity: number; onLaunch: (settings: MeteorSettings) => void; onClose: () => void; impacted: boolean }) {
  const [diameter, setDiameter] = useState(2)
  const [speed, setSpeed] = useState(20)
  const [angle, setAngle] = useState(45)
  const [events, setEvents] = useState<Fireball[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/nasa/fireballs', { signal: controller.signal })
      .then(async res => { if (!res.ok) throw new Error('NASA data unavailable'); return res.json() })
      .then(data => { setEvents(data.events ?? []); setLoading(false) })
      .catch(err => { if (err.name !== 'AbortError') { setError('NASA feed unavailable; manual experiment still works.'); setLoading(false) } })
    return () => controller.abort()
  }, [])
  const mass = Math.PI / 6 * diameter ** 3 * 3000 // assumed rocky density kg/m^3
  const energyKt = 0.5 * mass * (speed * 1000) ** 2 / 4.184e12
  const applyEvent = (event: Fireball) => {
    // NASA impact energy constrains speed for a chosen assumed diameter and density.
    // This is a hypothetical energy-matched scenario, not a reconstructed NASA trajectory.
    const inferredSpeed = Math.sqrt(2 * event.impactEnergyKt * 4.184e12 / mass) / 1000
    setSpeed(Math.round(THREE.MathUtils.clamp(inferredSpeed, 5, 70)))
  }
  const field = (label: string, value: number, unit: string, min: number, max: number, step: number, change: (n: number) => void) => <label className="block text-sm text-slate-200">
    <span className="mb-1 flex justify-between"><span>{label}</span><strong>{value} {unit}</strong></span>
    <input className="w-full accent-orange-400" type="range" min={min} max={max} step={step} value={value} onChange={e => change(Number(e.target.value))}/>
  </label>
  return <aside className="absolute bottom-24 left-3 top-3 z-30 w-[min(370px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-orange-300/30 bg-[#101a2b]/95 p-4 text-white shadow-2xl backdrop-blur-md sm:bottom-4 sm:left-auto sm:right-[210px] sm:top-20">
    <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><Flame className="text-orange-400"/> Meteor Lab</h2><button onClick={onClose} aria-label="Close Meteor Lab" className="rounded-full p-2 hover:bg-white/10"><X size={18}/></button></div>
    <p className="mb-4 text-xs text-slate-300">{worldName} · {gravity.toFixed(2)} m/s² · Simplified visual experiment</p>
    <div className="space-y-4">
      {field('Diameter', diameter, 'm', 1, 50, 1, setDiameter)}
      {field('Impact speed', speed, 'km/s', 5, 70, 1, setSpeed)}
      {field('Impact angle (above surface)', angle, '°', 10, 90, 5, setAngle)}
    </div>
    <div className="my-4 rounded-xl bg-orange-400/10 p-3"><div className="text-xs text-orange-200">Estimated kinetic energy</div><div className="text-2xl font-bold">{energyKt < 0.01 ? energyKt.toFixed(4) : energyKt.toFixed(2)} kt TNT</div><div className="text-xs text-slate-300">Assumes spherical rock, density 3,000 kg/m³, no atmospheric losses. Angle affects the animation, not energy.</div></div>
    <button onClick={() => onLaunch({ diameter, speed, angle })} className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-3 font-bold text-slate-950 hover:bg-orange-400"><Play size={18}/> Launch Meteor</button>
    {impacted && <p role="status" className="mt-2 text-sm text-orange-200">Impact animation complete. Change parameters and launch again.</p>}
    <div className="mt-5 border-t border-white/20 pt-4"><h3 className="mb-1 flex items-center gap-2 text-sm font-bold"><Database size={16}/> NASA/JPL Earth Fireball Records</h3><p className="mb-2 text-xs text-slate-300">Actual observed Earth atmospheric events. Choose one to match its reported energy approximately using the assumed rock mass. This does not reproduce its real speed, size, or trajectory.</p>
      {loading ? <p className="text-xs">Loading NASA data…</p> : error ? <p role="alert" className="text-xs text-amber-200">{error}</p> : events.length === 0 ? <p className="text-xs">No events returned.</p> : <div className="space-y-2">{events.slice(0, 5).map(event => <button key={event.date} onClick={() => applyEvent(event)} className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-xs hover:bg-white/15"><span>{event.date} UTC</span><span>{event.impactEnergyKt} kt <RotateCcw className="ml-1 inline" size={12}/></span></button>)}</div>}
      <a href="https://ssd-api.jpl.nasa.gov/doc/fireball.html" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-sky-300 underline">NASA/JPL Fireball API documentation <ExternalLink size={12}/></a>
    </div>
  </aside>
}

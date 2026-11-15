import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 3600

type NASAResponse = { signature?: { version?: string }; fields?: string[]; data?: (string | null)[][] }

export async function GET() {
  try {
    const response = await fetch('https://ssd-api.jpl.nasa.gov/fireball.api?limit=20', { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`NASA responded ${response.status}`)
    const payload = (await response.json()) as NASAResponse
    if (payload.signature?.version !== '1.2' || !Array.isArray(payload.fields) || !Array.isArray(payload.data)) throw new Error('Unexpected NASA response format')
    const index = (name: string) => payload.fields!.indexOf(name)
    const read = (row: (string | null)[], name: string) => { const i = index(name); return i < 0 ? null : row[i] }
    const num = (v: string | null) => v === null ? null : Number.isFinite(Number(v)) ? Number(v) : null
    const events = payload.data.map(row => ({
      date: read(row, 'date') ?? '',
      impactEnergyKt: num(read(row, 'impact-e')),
      altitudeKm: num(read(row, 'alt')),
      latitude: num(read(row, 'lat')),
      longitude: num(read(row, 'lon')),
    })).filter((e): e is typeof e & { impactEnergyKt: number } => e.impactEnergyKt !== null && e.impactEnergyKt > 0)
    return NextResponse.json({ source: 'NASA/JPL CNEOS Fireball Data API', version: payload.signature.version, events })
  } catch (error) {
    console.error('NASA Fireball API:', error)
    return NextResponse.json({ error: 'NASA Fireball API is temporarily unavailable' }, { status: 502 })
  }
}

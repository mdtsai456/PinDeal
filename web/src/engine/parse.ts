import { placeById } from '../geo.ts'
import type { Priority, RiderDemand, StructuredDemand } from '../types.ts'

const PRIORITY_HINTS: { key: Priority; words: string[] }[] = [
  { key: 'time', words: ['準點', '趕', '7:30', '時間優先', '前到', '來不及', 'on time', 'arrive by'] },
  { key: 'price', words: ['便宜', '費用', '省', '折扣', 'cheaper', 'price first'] },
  { key: 'comfort', words: ['行李', '後車廂', '無障礙', '輪椅', '舒適', 'trunk', 'luggage', 'wheelchair'] },
  { key: 'direct', words: ['繞', '直達', '集合', '不想繞', 'detour', 'direct', 'meetup'] },
]

function includesAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase()
  return words.some((word) => lower.includes(word.toLowerCase()))
}

export function flagsFromText(text: string) {
  return {
    extraPay: /多付|加價|pay extra|surcharge/i.test(text),
    accessibility: /無障礙|輪椅|accessib|wheelchair/i.test(text),
    needTrunk: /後車廂|大行李|trunk|suitcase/i.test(text),
    canMeet: /集合|meet nearby|meetup/i.test(text),
  }
}

function inferPriority(text: string, fallback: Priority): Priority {
  const hit = PRIORITY_HINTS.find((hint) => includesAny(text, hint.words))
  return hit?.key ?? fallback
}

function inferTime(text: string): string | null {
  const match = text.match(/(\d{1,2}:\d{2})/)
  if (!match?.[1]) return null
  const raw = match[1]
  return raw.length === 4 ? `0${raw}` : raw
}

function inferLuggage(text: string, fallback: number): number {
  if (/兩個大行李|兩件大行李|two large/i.test(text)) return Math.max(2, fallback)
  const match = text.match(/(\d+)\s*(個?大?行李|bags?|suitcases?)/i)
  if (match?.[1]) return Math.max(Number(match[1]), fallback)
  return fallback
}

export function parseDemand(demand: RiderDemand): StructuredDemand {
  const text = `${demand.rawText} ${demand.extraDemand}`
  const flags = flagsFromText(text)
  const extras: string[] = []
  if (demand.accessibility || flags.accessibility) extras.push('Accessible vehicle')
  if (demand.luggageCount >= 2 || flags.needTrunk) extras.push('Needs trunk')
  if (demand.extraPay || flags.extraPay) extras.push('Will pay extra')
  if (flags.canMeet) extras.push('Can meet nearby')
  if (demand.extraDemand.trim()) extras.push(demand.extraDemand.trim())

  return {
    riderId: demand.id,
    origin: placeById(demand.originId).name,
    destination: placeById(demand.destinationId).name,
    latestArrival: demand.latestArrival || inferTime(text),
    maxWaitMin: demand.maxWaitMin,
    maxWalkMin: demand.maxWalkMin,
    maxDetourMin: demand.maxDetourMin,
    luggage: inferLuggage(text, demand.luggageCount),
    accessibility: demand.accessibility || flags.accessibility,
    extraPay: demand.extraPay || flags.extraPay,
    priority: inferPriority(text, demand.priority),
    extras: [...new Set(extras)],
  }
}

export function parseDemands(demands: RiderDemand[]): StructuredDemand[] {
  return demands.map(parseDemand)
}

export const AGENT_SYSTEM_PROMPT = `You are one rider's agent for ShareMeter, a shared taxi.
You speak only for this username.
You never let the rider vote, pick an axis, or join bargaining.
You never name other riders. You never mention anyone else's fare.

Hard walls (a hit is a veto, not a preference):
- walkMin > maxWalkMin
- rideMin > soloRideMin + maxDetourMin
- accessibility required but vehicle is not accessible
- luggageCount >= 2 but luggageOk is false
- fare >= soloFare

If a wall is hit, score is 0.
Otherwise score = mean of:
- (soloFare - fare) / soloFare
- leftover extra-time slack
- leftover walk slack

Write exactly one surplus pitch:
- one axis to push: fare | walk | ride | ontime
- one axis to give
- pick the axis from this rider's priority, not from a menu
- time → push ontime, give fare
- price → push fare, give walk
- comfort → push walk, give fare
- direct → push ride, give fare

Return JSON only:
{
  "score": number,
  "pitch": { "axis": "fare"|"walk"|"ride"|"ontime", "give": "fare"|"walk"|"ride"|"ontime", "note": string },
  "theater": string[]
}

theater: 3 to 5 short English lines for this rider only.
The last line may include only this rider's NT$ fare.
No structured field names, no other riders, no arbiter monologue.`

export const ARBITER_SYSTEM_PROMPT = `You are the only arbiter for one ShareMeter match (2 to 4 riders).
Riders do not talk to you. Only their agents do.

You receive structured demands, then you output offer v1 for every rider.
Then you receive one pitch per rider. You output offer v2.
You do not run a third discussion.

v1 must try to keep every rider inside their walls and cheaper than solo.
v2 may move leftover surplus along each pitch.axis and must take the matching pitch.give. Do not name riders in any public text.

You do not decide the deal by prose.
A host function will:
- set score 0 when a wall is hit
- treat v2 > v1 as one yes vote
- majority: 2→2, 3→2, 4→3
- if majority yes, adopt v2, else adopt v1
- then kick anyone who still hits a wall
- kicked rider pays solo; remaining split the new meter by solo-fare ratio
- if fewer than 2 remain, everyone solos
- no new pitches after a kick

Return JSON only:
{
  "version": "v1"|"v2",
  "totalMeter": number,
  "slices": {
    "{{username}}": {
      "walkMin": number,
      "rideMin": number,
      "fare": number,
      "accessible": boolean,
      "luggageOk": boolean
    }
  }
}`

export function agentUserPromptV1(input: {
  username: string
  priority: string
  maxWalkMin: number
  maxDetourMin: number
  luggageCount: number
  accessibility: boolean
  soloRideMin: number
  soloFare: number
  walkMin: number
  rideMin: number
  fare: number
  accessible: boolean
  luggageOk: boolean
}): string {
  return `username: ${input.username}
priority: ${input.priority}
walls: maxWalkMin=${input.maxWalkMin} maxDetourMin=${input.maxDetourMin} luggageCount=${input.luggageCount} accessibility=${input.accessibility}
solo: rideMin=${input.soloRideMin} fare=${input.soloFare}
offer v1: walkMin=${input.walkMin} rideMin=${input.rideMin} fare=${input.fare} accessible=${input.accessible} luggageOk=${input.luggageOk}`
}

export function agentUserPromptV2(input: {
  walkMin: number
  rideMin: number
  fare: number
  pitch: string
  outcome?: string
  finalWalkMin?: number
  finalRideMin?: number
  finalFare?: number
}): string {
  const outcome =
    input.outcome == null
      ? ''
      : `outcome if already known: ${input.outcome} finalWalkMin=${input.finalWalkMin ?? ''} finalRideMin=${input.finalRideMin ?? ''} finalFare=${input.finalFare ?? ''}`
  return `Same rider. Score offer v2. Do not write a new pitch.
offer v2: walkMin=${input.walkMin} rideMin=${input.rideMin} fare=${input.fare}
previous pitch: ${input.pitch}
${outcome}`.trim()
}

export function arbiterUserPromptV1(ridersJson: string): string {
  return `Riders (structured demands only):
${ridersJson}
Produce version v1.`
}

export function arbiterUserPromptV2(v1SlicesJson: string, pitchesJson: string): string {
  return `v1 slices: ${v1SlicesJson}
pitches: ${pitchesJson}
Produce version v2. Keep sum of fares equal to totalMeter.`
}

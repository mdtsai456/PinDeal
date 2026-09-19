export type RiderId = 'A' | 'B' | 'C' | 'D'

export type Username = 'Yu' | 'Chiang' | 'Lin' | 'Yang'

export type Priority = 'time' | 'price' | 'comfort' | 'direct'

export type Place = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

export type SavedSlotId = 'home' | 'work' | 'favorite'

export type SavedSlot = {
  id: SavedSlotId
  label: string
  place: Place | null
}

export type LatLng = {
  lat: number
  lng: number
}

export type RiderDemand = {
  id: RiderId
  name: string
  title: string
  rawText: string
  originId: string
  destinationId: string
  latestArrival: string
  maxWaitMin: number
  maxWalkMin: number
  maxDetourMin: number
  luggageCount: number
  accessibility: boolean
  extraDemand: string
  priority: Priority
  extraPay: boolean
  // 此欄只給該名乘客讀。其他乘客的畫面不得讀。
  privateFloor: {
    maxFare: number
    note: string
  }
}

export type StructuredDemand = {
  riderId: RiderId
  origin: string
  destination: string
  latestArrival: string | null
  maxWaitMin: number
  maxWalkMin: number
  maxDetourMin: number
  luggage: number
  accessibility: boolean
  extraPay: boolean
  priority: Priority
  extras: string[]
}

export type StopKind = 'walkStart' | 'pickup' | 'dropoff' | 'walkEnd' | 'meet' | 'peerPickup' | 'peerDropoff'

export type RouteStop = {
  id: string
  kind: StopKind
  riderId: RiderId
  placeId: string
  time: string
  waitMin: number
  order?: number
}

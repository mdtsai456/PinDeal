import type { Place, RiderDemand, RiderId } from './types.ts'

export const PLACES: Record<string, Place> = {
  nthuGym: {
    id: 'nthuGym',
    name: 'NTHU Gymnasium',
    address: 'No. 101, Sec. 2, Guangfu Rd, East Dist, Hsinchu',
    lat: 24.7956,
    lng: 120.9925,
  },
  hsinchuStation: {
    id: 'hsinchuStation',
    name: 'Hsinchu Railway Station',
    address: 'No. 445, Sec. 2, Zhonghua Rd, East Dist, Hsinchu',
    lat: 24.8018,
    lng: 120.9717,
  },
  hsinchuDongmen: {
    id: 'hsinchuDongmen',
    name: 'Dongmen Circle',
    address: 'Dongmen St, East Dist, Hsinchu',
    lat: 24.803,
    lng: 120.9706,
  },
  hsinchuBeida: {
    id: 'hsinchuBeida',
    name: 'Beida Road Market',
    address: 'Beida Rd, East Dist, Hsinchu',
    lat: 24.8021,
    lng: 120.9734,
  },
  hsinchuGuohua: {
    id: 'hsinchuGuohua',
    name: 'Guohua Street',
    address: 'Guohua St, East Dist, Hsinchu',
    lat: 24.8007,
    lng: 120.9709,
  },
  nthuLibrary: {
    id: 'nthuLibrary',
    name: 'NTHU Library',
    address: 'No. 101, Sec. 2, Guangfu Rd, East Dist, Hsinchu',
    lat: 24.7965,
    lng: 120.9938,
  },
  nthuMainGate: {
    id: 'nthuMainGate',
    name: 'NTHU Main Gate',
    address: 'Guangfu Rd, East Dist, Hsinchu',
    lat: 24.795,
    lng: 120.9913,
  },
  nycuStudent: {
    id: 'nycuStudent',
    name: 'NYCU Student Center',
    address: 'University Rd, East Dist, Hsinchu',
    lat: 24.7969,
    lng: 120.9918,
  },
}

export const PLACE_LIST = Object.values(PLACES)

export const YOU_ID: RiderId = 'A'

export const POSTER_RIDERS: Record<RiderId, RiderDemand> = {
  A: {
    id: 'A',
    name: 'Yu',
    title: 'Ms.',
    rawText:
      'Pickup at Hsinchu Railway Station, dropoff at NTHU Gymnasium. Arrive by 21:40. I can pay extra, but do not wait more than 10 minutes.',
    originId: 'hsinchuStation',
    destinationId: 'nthuGym',
    latestArrival: '21:40',
    maxWaitMin: 10,
    maxWalkMin: 8,
    maxDetourMin: 20,
    luggageCount: 1,
    accessibility: false,
    extraDemand: 'Time first. Will pay extra to stay on time.',
    priority: 'time',
    extraPay: true,
    privateFloor: {
      maxFare: 480,
      note: 'Hard cutoff 21:40. Fare cap 480.',
    },
  },
  B: {
    id: 'B',
    name: 'Lin',
    title: 'Mr.',
    rawText:
      'Pickup at Beida Road Market, dropoff at NTHU Library. Time is flexible. I want a lower fare and can wait up to 15 minutes.',
    originId: 'hsinchuBeida',
    destinationId: 'nthuLibrary',
    latestArrival: '08:00',
    maxWaitMin: 15,
    maxWalkMin: 10,
    maxDetourMin: 18,
    luggageCount: 1,
    accessibility: false,
    extraDemand: 'Price first.',
    priority: 'price',
    extraPay: false,
    privateFloor: {
      maxFare: 280,
      note: 'Fare cap 280. Can wait 15 min.',
    },
  },
  C: {
    id: 'C',
    name: 'Chiang',
    title: 'Ms.',
    rawText:
      'Pickup at Dongmen Circle, dropoff at NTHU Main Gate. I have two large suitcases and need trunk space.',
    originId: 'hsinchuDongmen',
    destinationId: 'nthuMainGate',
    latestArrival: '07:40',
    maxWaitMin: 12,
    maxWalkMin: 6,
    maxDetourMin: 15,
    luggageCount: 2,
    accessibility: false,
    extraDemand: 'Large luggage. Needs trunk.',
    priority: 'comfort',
    extraPay: false,
    privateFloor: {
      maxFare: 320,
      note: 'Must have a trunk. Cap 320.',
    },
  },
  D: {
    id: 'D',
    name: 'Yang',
    title: 'Mr.',
    rawText:
      'Pickup at Guohua Street, dropoff at NYCU Student Center. I do not want a long detour. I can walk to a nearby meetup.',
    originId: 'hsinchuGuohua',
    destinationId: 'nycuStudent',
    latestArrival: '07:50',
    maxWaitMin: 8,
    maxWalkMin: 10,
    maxDetourMin: 10,
    luggageCount: 0,
    accessibility: false,
    extraDemand: 'Keep the detour short. Can walk to a meetup.',
    priority: 'direct',
    extraPay: false,
    privateFloor: {
      maxFare: 260,
      note: 'Detour cap 10 min. Fare cap 260.',
    },
  },
}

export function cloneRider(id: RiderId): RiderDemand {
  const src = POSTER_RIDERS[id]
  return { ...src, privateFloor: { ...src.privateFloor } }
}

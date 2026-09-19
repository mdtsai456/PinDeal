import { useEffect, useRef } from 'react'
import L from 'leaflet'
import viaPinUrl from '../assets/via-pin.svg?url'
import { RIDER_TINT } from '../data'
import { placeById } from '../geo'
import { cardRect, iconLayout, pickCardSide, pointAlongPath, sampleLine, type CardSide, type Pt, type Rect } from '../mapCards'
import { stopMark } from '../labels'
import type { Circle } from '../engine/corridor'
import type { LatLng, RiderId, RouteStop } from '../types'

type MapVariant = 'pins' | 'booking' | 'direct'

type MapCanvasProps = {
  stops: RouteStop[]
  polyline: LatLng[]
  taxi?: LatLng | null
  you?: LatLng | null
  interactive?: boolean
  variant?: MapVariant
  onPick?: (lat: number, lng: number) => void
  walkCircles?: { origin: Circle; dest: Circle }
  walkPolylines?: LatLng[][]
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function originCardIcon(kind: 'pickup' | 'dropoff', label: string, side: CardSide): L.DivIcon {
  const role = kind === 'pickup' ? 'Pickup' : 'Dropoff'
  const layout = iconLayout(side)
  return L.divIcon({
    className: 'pin pin-fixed',
    html: `<div class="direct-pin direct-pin-${side}"><div class="origin-dot origin-dot-${kind}"></div><div class="map-card"><span>${role}</span><b>${escapeHtml(label)}</b></div></div>`,
    iconSize: layout.size,
    iconAnchor: layout.anchor,
  })
}

function toPt(point: L.Point): Pt {
  return { x: point.x, y: point.y }
}

function lineContainerPts(map: L.Map, polyline: LatLng[]): Pt[] {
  return polyline.map((point) => toPt(map.latLngToContainerPoint([point.lat, point.lng])))
}

function peerToward(map: L.Map, stops: RouteStop[], item: RouteStop): Pt {
  const peer = stops.find((stop) => stop.id !== item.id)
  if (!peer) return { x: 0, y: 0 }
  const place = placeById(peer.placeId)
  return toPt(map.latLngToContainerPoint([place.lat, place.lng]))
}

function paintDirectStops(map: L.Map, layer: L.LayerGroup, stops: RouteStop[], polyline: LatLng[]): void {
  const mapSize = map.getSize()
  const size: Pt = { x: mapSize.x, y: mapSize.y }
  const origins = stops.filter((item) => item.kind === 'pickup' || item.kind === 'dropoff')
  const linePts = lineContainerPts(map, polyline)
  const dense = sampleLine(linePts)
  const blocked: Rect[] = []
  origins.forEach((item) => {
    const place = placeById(item.placeId)
    const dot = toPt(map.latLngToContainerPoint([place.lat, place.lng]))
    const fromStart = item.kind !== 'dropoff'
    const toward = linePts.length > 1 ? pointAlongPath(linePts, fromStart) : peerToward(map, origins, item)
    const side = pickCardSide(dot, toward, dense, size, blocked)
    blocked.push(cardRect(dot, side))
    L.marker([place.lat, place.lng], {
      icon: originCardIcon(item.kind === 'dropoff' ? 'dropoff' : 'pickup', place.name, side),
      keyboard: false,
      pane: 'fixedLabels',
    }).addTo(layer)
  })
}

function iconFor(variant: MapVariant, item: RouteStop, label: string, side: CardSide = 'e'): L.DivIcon {
  switch (variant) {
    case 'direct':
      return originCardIcon(item.kind === 'dropoff' ? 'dropoff' : 'pickup', label, side)
    case 'booking':
      return bookingIcon(item)
    case 'pins':
      return stopIcon(item.riderId, item.kind)
    default: {
      const _exhaustive: never = variant
      return _exhaustive
    }
  }
}

function stopIcon(riderId: RiderId, kind: RouteStop['kind']): L.DivIcon {
  const tint = RIDER_TINT[riderId]
  const mark = stopMark(kind)
  return L.divIcon({
    className: 'pin',
    html: `<div class="pin-dot" style="background:${tint}"><b>${riderId}</b><i>${mark}</i></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

function bookingIcon(item: RouteStop): L.DivIcon {
  switch (item.kind) {
    case 'meet':
      return L.divIcon({
        className: 'pin pin-via',
        html: `<img class="via-pin" src="${viaPinUrl}" alt="" />`,
        iconSize: [16, 24],
        iconAnchor: [8, 24],
      })
    case 'pickup':
      return L.divIcon({
        className: 'pin',
        html: '<div class="origin-dot origin-dot-pickup"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
    case 'dropoff':
      return L.divIcon({
        className: 'pin',
        html: '<div class="origin-dot origin-dot-dropoff"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
    case 'walkStart':
      return L.divIcon({
        className: 'pin',
        html: '<div class="walk-dot walk-dot-start"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
    case 'walkEnd':
      return L.divIcon({
        className: 'pin',
        html: '<div class="walk-dot walk-dot-end"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
    case 'peerPickup':
      return peerDotIcon('pickup', item.order)
    case 'peerDropoff':
      return peerDotIcon('dropoff', item.order)
    default: {
      const _exhaustive: never = item.kind
      return _exhaustive
    }
  }
}

function peerDotIcon(kind: 'pickup' | 'dropoff', order?: number): L.DivIcon {
  const label = order == null ? '' : String(order)
  return L.divIcon({
    className: 'pin',
    html: `<div class="peer-dot peer-dot-${kind}">${label}</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function bookingPoint(item: RouteStop, place: { lat: number; lng: number }): LatLng {
  switch (item.kind) {
    case 'meet':
    case 'peerPickup':
    case 'peerDropoff':
    case 'pickup':
    case 'dropoff':
    case 'walkStart':
    case 'walkEnd':
      return place
    default: {
      const _exhaustive: never = item.kind
      return _exhaustive
    }
  }
}

function taxiIcon(): L.DivIcon {
  return L.divIcon({
    className: 'pin',
    html: '<div class="taxi-dot">T</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export function MapCanvas({
  stops,
  polyline,
  taxi,
  you,
  interactive = false,
  variant = 'pins',
  onPick,
  walkCircles,
  walkPolylines = [],
}: MapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const lineRef = useRef<L.Polyline | null>(null)
  const casingRef = useRef<L.Polyline | null>(null)
  const taxiRef = useRef<L.Marker | null>(null)
  const youRef = useRef<L.CircleMarker | null>(null)
  const stopLayerRef = useRef<L.LayerGroup | null>(null)
  const walkLayerRef = useRef<L.LayerGroup | null>(null)
  const walkDashLayerRef = useRef<L.LayerGroup | null>(null)
  const onPickRef = useRef(onPick)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    const host = hostRef.current
    if (!host || mapRef.current) return

    const map = L.map(host, {
      zoomControl: false,
      attributionControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)
    map.setView([25.0478, 121.517], 12)
    if (!map.getPane('fixedLabels')) {
      const pane = map.createPane('fixedLabels')
      pane.style.zIndex = '650'
      pane.style.pointerEvents = 'none'
    }
    if (!map.getPane('walkCircles')) {
      const pane = map.createPane('walkCircles')
      pane.style.zIndex = '350'
      pane.style.pointerEvents = 'none'
    }
    mapRef.current = map
    stopLayerRef.current = L.layerGroup().addTo(map)
    walkLayerRef.current = L.layerGroup().addTo(map)
    walkDashLayerRef.current = L.layerGroup().addTo(map)
    const timer = window.setTimeout(() => map.invalidateSize(), 80)
    map.on('click', (event: L.LeafletMouseEvent) => {
      onPickRef.current?.(event.latlng.lat, event.latlng.lng)
    })

    return () => {
      window.clearTimeout(timer)
      map.remove()
      mapRef.current = null
      walkLayerRef.current = null
      walkDashLayerRef.current = null
    }
  }, [interactive])

  useEffect(() => {
    const map = mapRef.current
    const layer = stopLayerRef.current
    if (!map || !layer) return
    if (lineRef.current) {
      lineRef.current.remove()
      lineRef.current = null
    }
    if (casingRef.current) {
      casingRef.current.remove()
      casingRef.current = null
    }
    if (polyline.length > 1) {
      const latlngs = polyline.map((point) => [point.lat, point.lng] as L.LatLngExpression)
      if (variant === 'direct' || variant === 'booking') {
        casingRef.current = L.polyline(latlngs, { color: '#FFFFFF', weight: 8, opacity: 0.95 }).addTo(map)
        lineRef.current = L.polyline(latlngs, { color: '#1A73E8', weight: 5, opacity: 1 }).addTo(map)
      } else {
        lineRef.current = L.polyline(latlngs, { color: '#12151A', weight: 4, opacity: 0.85 }).addTo(map)
      }
    }

    const dashLayer = walkDashLayerRef.current
    if (dashLayer) {
      dashLayer.clearLayers()
      walkPolylines.forEach((leg) => {
        if (leg.length < 2) return
        L.polyline(
          leg.map((point) => [point.lat, point.lng] as L.LatLngExpression),
          { color: '#1A73E8', weight: 3, opacity: 0.9, dashArray: '6 8', interactive: false },
        ).addTo(dashLayer)
      })
    }

    const fitPad: L.PointExpression = variant === 'direct' || variant === 'booking' ? [48, 52] : [36, 44]
    const fitLine = () => {
      const points = [...polyline, ...walkPolylines.flat()]
      if (points.length === 0) return
      const first = points[0]
      if (!first) return
      const bounds = L.latLngBounds([first.lat, first.lng], [first.lat, first.lng])
      points.forEach((point) => bounds.extend([point.lat, point.lng]))
      map.fitBounds(bounds, { padding: fitPad })
    }
    fitLine()

    const paintStops = () => {
      layer.clearLayers()
      if (variant === 'direct') {
        paintDirectStops(map, layer, stops, polyline)
        return
      }
      stops.forEach((item) => {
        const place = placeById(item.placeId)
        const point = variant === 'booking' ? bookingPoint(item, place) : place
        L.marker([point.lat, point.lng], {
          icon: iconFor(variant, item, place.name),
          keyboard: false,
        }).addTo(layer)
      })
    }

    paintStops()
    const timer = window.setTimeout(() => {
      map.invalidateSize()
      fitLine()
      paintStops()
    }, 120)
    return () => window.clearTimeout(timer)
  }, [polyline, stops, variant, walkPolylines])

  useEffect(() => {
    const map = mapRef.current
    const layer = walkLayerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    if (!walkCircles) return
    const rings: { circle: Circle; color: string }[] = [
      { circle: walkCircles.origin, color: '#1A73E8' },
      { circle: walkCircles.dest, color: '#E07A3D' },
    ]
    rings.forEach(({ circle, color }) => {
      L.circle([circle.lat, circle.lng], {
        radius: circle.radiusKm * 1000,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.12,
        opacity: 0.7,
        interactive: false,
        pane: 'walkCircles',
      }).addTo(layer)
    })
  }, [walkCircles])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !taxi) return
    if (!taxiRef.current) {
      taxiRef.current = L.marker([taxi.lat, taxi.lng], { icon: taxiIcon() }).addTo(map)
    } else {
      taxiRef.current.setLatLng([taxi.lat, taxi.lng])
    }
  }, [taxi])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !you) return
    if (!youRef.current) {
      youRef.current = L.circleMarker([you.lat, you.lng], {
        radius: 8,
        color: '#12151A',
        fillColor: '#FFD000',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map)
    } else {
      youRef.current.setLatLng([you.lat, you.lng])
    }
  }, [you])

  return <div ref={hostRef} className="map-canvas" />
}
// =====================================================================
//  LeafletMap — sputnik karta (Esri World Imagery, API kaliti kerak emas)
//  props:
//    center [lat,lng], zoom
//    markers [{lat,lng,type,label,html}]  (type -> rang)
//    route   [[lat,lng],...]              (yo'nalish chizig'i)
//    myLocation {lat,lng} draggable       (o'z manzil)
//    onMapClick(latlng)                   (manzil belgilash uchun)
//    onMyDrag(latlng)
// =====================================================================
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const COLORS = {
  me: '#1363DF', warehouse: '#1e9e61', logistics: '#c77f1e',
  market: '#d14b3c', seller: '#0e8f8c', buyer: '#6e5aa6',
}
const GLYPH = { me: '●', warehouse: 'O', logistics: 'L', market: 'B', seller: 'S', buyer: 'X' }

function pinIcon(type) {
  const c = COLORS[type] || '#334'
  const g = GLYPH[type] || ''
  return L.divIcon({
    className: 'mpin-wrap',
    html: `<div class="mpin" style="background:${c}"><span>${g}</span></div>`,
    iconSize: [26, 34],
    iconAnchor: [13, 32],
    popupAnchor: [0, -30],
  })
}

export default function LeafletMap({
  center = [40.5, 66.5],
  zoom = 6,
  markers = [],
  route = null,
  myLocation = null,
  onMapClick = null,
  onMyDrag = null,
  height = 520,
}) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const routeRef = useRef(null)
  const myRef = useRef(null)
  const clickCbRef = useRef(onMapClick)
  const dragCbRef = useRef(onMyDrag)
  clickCbRef.current = onMapClick
  dragCbRef.current = onMyDrag

  // xaritani bir marta yaratish
  useEffect(() => {
    if (mapRef.current || !elRef.current) return
    const map = L.map(elRef.current, { center, zoom, zoomControl: true, attributionControl: true })
    // Esri sputnik tasviri (bepul, atribut talab qilinadi)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles © Esri' }
    ).addTo(map)
    // joy nomlari / chegaralar qatlami
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, opacity: 0.9 }
    ).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    map.on('click', (e) => { if (clickCbRef.current) clickCbRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }) })
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 60)
    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // markerlarni yangilash
  useEffect(() => {
    const map = mapRef.current, lg = layerRef.current
    if (!map || !lg) return
    lg.clearLayers()
    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return
      const mk = L.marker([m.lat, m.lng], { icon: pinIcon(m.type) })
      if (m.html) mk.bindPopup(m.html)
      else if (m.label) mk.bindTooltip(m.label)
      mk.addTo(lg)
    })
  }, [markers])

  // yo'nalish chizig'i
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (routeRef.current) { map.removeLayer(routeRef.current); routeRef.current = null }
    if (route && route.length > 1) {
      const line = L.polyline(route, { color: '#1363DF', weight: 4, opacity: 0.85, dashArray: '2,8' }).addTo(map)
      routeRef.current = line
      try { map.fitBounds(line.getBounds().pad(0.2)) } catch (e) { /* ignore */ }
    }
  }, [route])

  // o'z manzilim (draggable)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (myRef.current) { map.removeLayer(myRef.current); myRef.current = null }
    if (myLocation && myLocation.lat != null) {
      const mk = L.marker([myLocation.lat, myLocation.lng], { icon: pinIcon('me'), draggable: !!onMyDrag, zIndexOffset: 1000 })
      mk.bindTooltip('Sizning manzilingiz', { permanent: false })
      if (onMyDrag) mk.on('dragend', () => {
        const p = mk.getLatLng()
        if (dragCbRef.current) dragCbRef.current({ lat: p.lat, lng: p.lng })
      })
      mk.addTo(map)
      myRef.current = mk
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLocation])

  return <div ref={elRef} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }} />
}

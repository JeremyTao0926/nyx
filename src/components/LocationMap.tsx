import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { C } from "../utils";

// Free, no-API-key dark basemap (matches the app's dark theme) — same OSM
// data ecosystem the app already uses for Nominatim geocoding.
const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

function pinIcon(emoji: string, bg: string, size = 34) {
  return L.divIcon({
    className: "nyx-map-pin",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;background:${bg};transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.5);border:2px solid rgba(255,255,255,0.3)"><span style="transform:rotate(45deg);font-size:${Math.round(size * 0.5)}px;line-height:1">${emoji}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Deterministic jitter (~0.3-0.7km) so another person's pin never reveals
// their literal address — stable per user id, not re-randomized on render.
function jitteredPosition(id: string, lat: number, lon: number): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const angle = (h % 360) * (Math.PI / 180);
  const meters = 300 + (h % 400);
  const dLat = (meters * Math.cos(angle)) / 111320;
  const dLon = (meters * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lon + dLon];
}

function ClickToPick({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lon]); }, [lat, lon]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/* ─── Nearby-people map (Explore screen) ─────────────── */
export function NearbyMap({ me, others, onSelect }: {
  me: { latitude: number; longitude: number };
  others: { id: string; name: string; distance?: number; latitude: number; longitude: number }[];
  onSelect?: (id: string) => void;
}) {
  const center: [number, number] = [me.latitude, me.longitude];
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <MapContainer center={center} zoom={12} style={{ width: "100%", height: "100%", background: C.bg }} zoomControl={false}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        <Marker position={center} icon={pinIcon("📍", C.rose, 38)}>
          <Popup>你的位置</Popup>
        </Marker>
        {others.filter(o => o.latitude != null && o.longitude != null).map(o => {
          const pos = jitteredPosition(o.id, o.latitude, o.longitude);
          return (
            <Marker key={o.id} position={pos} icon={pinIcon("💛", C.gold, 32)}
              eventHandlers={{ click: () => onSelect?.(o.id) }}>
              <Popup>{o.name}{o.distance != null ? ` · ${Math.round(o.distance)}km` : ""}</Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

/* ─── Location picker (Profile / onboarding) ─────────── */
export function LocationPickerMap({ latitude, longitude, onChange }: {
  latitude: number; longitude: number; onChange: (lat: number, lon: number) => void;
}) {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <MapContainer center={[latitude, longitude]} zoom={11} style={{ width: "100%", height: "100%" }} zoomControl={false}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        <Marker position={[latitude, longitude]} icon={pinIcon("📍", C.rose, 38)} draggable
          eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng); } }} />
        <ClickToPick onPick={onChange} />
        <Recenter lat={latitude} lon={longitude} />
      </MapContainer>
    </div>
  );
}

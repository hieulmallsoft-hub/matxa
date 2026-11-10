import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search } from 'lucide-react';

/** Hanoi centre, shown when the venue has no coordinates yet. */
const DEFAULT_CENTER: [number, number] = [21.0285, 105.8542];

const pin = L.divIcon({
  className: '',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  html: '<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 36 14 36s14-11.7 14-22.1C28 6.2 21.7 0 14 0z" fill="#2E7D4A"/><circle cx="14" cy="14" r="5.5" fill="#fff"/></svg>',
});

interface SearchResult {
  lat: number;
  lon: number;
  label: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

const label = ({ properties: p }: PhotonFeature) =>
  [p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street, p.name !== p.street ? p.name : undefined, p.district, p.city ?? p.state]
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(', ');

interface Props {
  latitude: string;
  longitude: string;
  /** `address` is set only when the admin picked a search result. */
  onPick: (latitude: number, longitude: number, address?: string) => void;
}

const valid = (latitude: string, longitude: string) =>
  latitude.trim() !== '' && longitude.trim() !== '' && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

/**
 * Map picker for a venue: search an address, click the map or drag the pin. Works over plain HTTP, unlike the
 * browser's "current location", which needs HTTPS. CARTO tiles and Photon search (both OpenStreetMap data) need no
 * API key, and stay reachable from Vietnamese networks that block openstreetmap.org itself.
 */
export function LocationPicker({ latitude, longitude, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const place = (lat: number, lng: number) => {
    if (!map.current) return;
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { icon: pin, draggable: true }).addTo(map.current);
      marker.current.on('dragend', () => {
        const at = marker.current!.getLatLng();
        pickRef.current(round(at.lat), round(at.lng));
      });
    } else {
      marker.current.setLatLng([lat, lng]);
    }
  };

  useEffect(() => {
    if (!box.current || map.current) return;
    const start: [number, number] = valid(latitude, longitude) ? [Number(latitude), Number(longitude)] : DEFAULT_CENTER;
    map.current = L.map(box.current, { center: start, zoom: valid(latitude, longitude) ? 16 : 12 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map.current);
    if (valid(latitude, longitude)) place(Number(latitude), Number(longitude));
    map.current.on('click', (event: L.LeafletMouseEvent) => {
      place(event.latlng.lat, event.latlng.lng);
      pickRef.current(round(event.latlng.lat), round(event.latlng.lng));
    });
    // The form opens in a drawer/modal that animates in; measure again once it has its final size.
    const resize = window.setTimeout(() => map.current?.invalidateSize(), 300);
    return () => {
      window.clearTimeout(resize);
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coordinates typed by hand (or from "current location") move the pin too.
  useEffect(() => {
    if (!map.current || !valid(latitude, longitude)) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    const current = marker.current?.getLatLng();
    if (current && Math.abs(current.lat - lat) < 1e-7 && Math.abs(current.lng - lng) < 1e-7) return;
    place(lat, lng);
    map.current.setView([lat, lng], Math.max(map.current.getZoom(), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  const search = async () => {
    const text = query.trim();
    if (!text) return;
    setSearching(true);
    setSearchError('');
    try {
      // bbox = Vietnam, so results stay in the country.
      const response = await fetch(`https://photon.komoot.io/api/?limit=5&bbox=102.1,8.2,109.5,23.4&q=${encodeURIComponent(text)}`);
      if (!response.ok) throw new Error();
      const found: SearchResult[] = ((await response.json()) as { features: PhotonFeature[] }).features.map((feature) => ({
        lon: feature.geometry.coordinates[0],
        lat: feature.geometry.coordinates[1],
        label: label(feature),
      }));
      setResults(found);
      if (!found.length) setSearchError('Không tìm thấy địa chỉ. Thử ghi ngắn hơn, hoặc bấm thẳng lên bản đồ.');
    } catch {
      setSearchError('Không tìm được địa chỉ lúc này. Bạn có thể bấm thẳng lên bản đồ.');
    } finally {
      setSearching(false);
    }
  };

  const choose = (result: SearchResult) => {
    const lat = result.lat;
    const lng = result.lon;
    place(lat, lng);
    map.current?.setView([lat, lng], 17);
    setResults([]);
    onPick(round(lat), round(lng), result.label);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void search();
            }
          }}
          placeholder="Tìm địa chỉ trên bản đồ, ví dụ: 12 Lý Thường Kiệt, Hoàn Kiếm"
          className="flex-1 min-w-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={searching}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          <Search className="w-3.5 h-3.5" /> {searching ? 'Đang tìm...' : 'Tìm'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="rounded-lg border border-border bg-surface text-xs divide-y divide-border max-h-48 overflow-auto">
          {results.map((result) => (
            <li key={`${result.lat},${result.lon}`}>
              <button type="button" onClick={() => choose(result)} className="w-full text-left px-3 py-2 hover:bg-primary/10">
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {searchError && <p className="text-[11px] text-red-600">{searchError}</p>}
      <div ref={box} className="h-64 w-full rounded-xl border border-border overflow-hidden z-0" />
      <p className="text-[11px] text-content-secondary">Bấm lên bản đồ hoặc kéo ghim để chọn đúng vị trí, tọa độ sẽ tự điền.</p>
    </div>
  );
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

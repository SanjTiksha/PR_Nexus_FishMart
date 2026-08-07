import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

const DEFAULT_CENTER = { lat: 18.5082296, lng: 73.848883 }; // Sadashiv Peth, Pune

export const buildMapsLinks = (lat, lng) => ({
  mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
  navigateUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
});

/**
 * Auto-detect GPS + allow manual pin move on map before confirming delivery location.
 */
const DeliveryLocationPicker = ({ onChange }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const emitChange = useCallback((lat, lng, accuracy, isConfirmed) => {
    const links = buildMapsLinks(lat, lng);
    const payload = {
      lat,
      lng,
      accuracy,
      mapsUrl: links.mapsUrl,
      navigateUrl: links.navigateUrl,
      confirmed: isConfirmed,
      source: 'map'
    };
    setCoords({ lat, lng, accuracy });
    onChangeRef.current?.(payload);
  }, []);

  const setMarker = useCallback((lat, lng) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView([lat, lng], Math.max(map.getZoom(), 16));

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      return;
    }

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const { lat: newLat, lng: newLng } = marker.getLatLng();
      setConfirmed(false);
      emitChange(newLat, newLng, null, false);
      setStatus('ready');
    });
    markerRef.current = marker;
  }, [emitChange]);

  const detectLocation = useCallback(() => {
    setConfirmed(false);
    setError('');

    if (!navigator.geolocation) {
      setStatus('error');
      setError('Location not supported. Move the pin on the map to your delivery point.');
      setMarker(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
      emitChange(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, null, false);
      return;
    }

    setStatus('locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setMarker(latitude, longitude);
        emitChange(latitude, longitude, accuracy, false);
        setStatus('ready');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setStatus('error');
        setError('Could not auto-detect. Tap/drag the pin to your delivery location.');
        setMarker(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
        emitChange(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, null, false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }, [emitChange, setMarker]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: 16,
      scrollWheelZoom: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setMarker(lat, lng);
      setConfirmed(false);
      emitChange(lat, lng, null, false);
      setStatus('ready');
    });

    mapInstanceRef.current = map;
    const resizeTimers = [100, 350, 700].map((ms) =>
      setTimeout(() => map.invalidateSize(), ms)
    );
    detectLocation();

    return () => {
      resizeTimers.forEach(clearTimeout);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [detectLocation, emitChange, setMarker]);

  const handleConfirm = () => {
    if (!coords) {
      alert('Please set your delivery location on the map.');
      return;
    }
    setConfirmed(true);
    emitChange(coords.lat, coords.lng, coords.accuracy, true);
  };

  return (
    <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/40">
      <div className="px-3 py-2 flex items-center justify-between gap-2 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <MapPin className="w-4 h-4 text-blue-600" />
          Delivery Location *
        </div>
        <button
          type="button"
          onClick={detectLocation}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
        >
          {status === 'locating' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Auto-detect
        </button>
      </div>

      <div className="px-3 pt-2 text-xs text-gray-600">
        {status === 'locating' && 'Detecting your GPS location…'}
        {status === 'ready' && !confirmed && 'Pin set — drag or tap map to adjust, then confirm.'}
        {status === 'ready' && confirmed && 'Location confirmed for delivery.'}
        {status === 'error' && (error || 'Set location manually on the map.')}
        {status === 'idle' && 'Preparing map…'}
      </div>

      <div ref={mapRef} className="w-full h-56 sm:h-52 mt-2 z-0 touch-manipulation" />

      <div className="p-3 space-y-2">
        {coords && (
          <p className="text-xs text-gray-600 font-mono break-all">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            {coords.accuracy ? ` · ±${Math.round(coords.accuracy)}m` : ''}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={detectLocation}
            className="flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] py-2.5 px-3 text-sm rounded-lg border border-gray-300 bg-white active:bg-gray-100"
          >
            <Crosshair className="w-4 h-4" />
            Use GPS
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] py-2.5 px-3 text-sm rounded-lg font-medium ${
              confirmed
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white active:bg-blue-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {confirmed ? 'Confirmed' : 'Confirm location'}
          </button>
        </div>

        {confirmed && coords && (
          <a
            href={buildMapsLinks(coords.lat, coords.lng).navigateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-blue-600 hover:underline"
          >
            Preview navigation path on Google Maps →
          </a>
        )}
      </div>
    </div>
  );
};

export default DeliveryLocationPicker;

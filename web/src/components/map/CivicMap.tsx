import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { DEFAULT_MAP_CENTER } from '../../shared/constants';

interface MarkerData {
  id: string;
  latitude: number;
  longitude: number;
  primary_issue_type?: string;
  title?: string;
  type: 'incident' | 'cleanup';
}

interface Props {
  markers: MarkerData[];
  lguMode?: boolean;
}

export function CivicMap({ markers, lguMode = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!ref.current || !key) return;
    const loader = new Loader({ apiKey: key, version: 'weekly' });
    loader.load().then(() => {
      const m = new google.maps.Map(ref.current!, {
        center: DEFAULT_MAP_CENTER,
        zoom: 13,
        styles: lguMode ? undefined : [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
        disableDefaultUI: false,
      });
      setMap(m);
    });
  }, [lguMode]);

  useEffect(() => {
    if (!map) return;
    const gmarkers = markers.map((mk) => {
      const marker = new google.maps.Marker({
        position: { lat: mk.latitude, lng: mk.longitude },
        title: mk.primary_issue_type || mk.title,
        icon: mk.type === 'cleanup'
          ? undefined
          : { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#0066cc', fillOpacity: 1, strokeWeight: 0 },
      });
      return marker;
    });
    new MarkerClusterer({ markers: gmarkers, map });
  }, [map, markers]);

  return <div ref={ref} className="h-[70vh] w-full" />;
}

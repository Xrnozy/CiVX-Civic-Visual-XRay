import type { Cluster } from '@googlemaps/markerclusterer';
import {
  DEFAULT_MAP_PIN_ZOOM,
  DEFAULT_MAP_ZOOM,
  MAP_CLUSTER_MAX_ZOOM,
} from '../../shared/constants';

export const PREVIEW_CARD_HEIGHT = 256;
export const PREVIEW_MARKER_TAIL = 36;

type GMaps = typeof google.maps;

export function waitMapIdle(map: google.maps.Map, gmaps: GMaps): Promise<void> {
  return new Promise((resolve) => {
    gmaps.event.addListenerOnce(map, 'idle', () => resolve());
  });
}

/** Pin-level zoom — never zoom out from the current level. */
export function resolvePinZoom(map: google.maps.Map, minZoom = DEFAULT_MAP_PIN_ZOOM): number {
  const current = map.getZoom();
  const base = typeof current === 'number' ? current : DEFAULT_MAP_ZOOM;
  return Math.min(Math.max(base, minZoom), MAP_CLUSTER_MAX_ZOOM);
}

export async function moveCameraToPoint(
  map: google.maps.Map,
  gmaps: GMaps,
  lat: number,
  lng: number,
  minZoom = DEFAULT_MAP_PIN_ZOOM,
): Promise<number> {
  const beforeZoom = map.getZoom();
  const targetZoom = resolvePinZoom(map, minZoom);

  if (typeof beforeZoom === 'number' && beforeZoom >= targetZoom) {
    map.panTo({ lat, lng });
    await waitMapIdle(map, gmaps);

    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8322dc'},body:JSON.stringify({sessionId:'8322dc',runId:'progressive-cluster',hypothesisId:'H3',location:'mapFocus.ts:moveCameraToPoint',message:'pan only no zoom out',data:{lat,lng,beforeZoom,targetZoom,afterZoom:map.getZoom()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return beforeZoom;
  }

  return moveCamera(map, gmaps, lat, lng, targetZoom);
}

export async function panMarkerToPreviewAnchor(
  map: google.maps.Map,
  gmaps: GMaps,
  mapEl: HTMLElement,
  lat: number,
  lng: number,
  getTopInset: () => number,
): Promise<void> {
  const latLng = new gmaps.LatLng(lat, lng);

  await new Promise<void>((resolve) => {
    const overlay = new gmaps.OverlayView();
    overlay.onAdd = () => {};
    overlay.draw = () => {
      const projection = overlay.getProjection();
      if (!projection) return;

      const mapRect = mapEl.getBoundingClientRect();
      const topInset = getTopInset();
      const bottomPad = 28;
      const markerPx = projection.fromLatLngToContainerPixel(latLng);
      overlay.setMap(null);

      if (!markerPx) {
        resolve();
        return;
      }

      const targetX = mapRect.width / 2;
      const minMarkerY = topInset + PREVIEW_CARD_HEIGHT + PREVIEW_MARKER_TAIL + 12;
      const maxMarkerY = mapRect.height - bottomPad - PREVIEW_MARKER_TAIL;
      const targetY = Math.min(
        maxMarkerY,
        Math.max(minMarkerY, topInset + (mapRect.height - topInset - bottomPad) * 0.55),
      );

      const panX = markerPx.x - targetX;
      const panY = markerPx.y - targetY;

      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8322dc'},body:JSON.stringify({sessionId:'8322dc',runId:'rewrite',hypothesisId:'H2',location:'mapFocus.ts:panMarkerToPreviewAnchor',message:'preview anchor pan',data:{lat,lng,markerPxX:markerPx.x,markerPxY:markerPx.y,targetX,targetY,panX,panY,mapW:mapRect.width,mapH:mapRect.height,topInset},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (Math.abs(panX) <= 2 && Math.abs(panY) <= 2) {
        resolve();
        return;
      }

      gmaps.event.addListenerOnce(map, 'idle', () => resolve());
      map.panBy(panX, panY);
    };
    overlay.setMap(map);
  });
}

/** Zoom to pin level, then frame the marker for the floating preview card. */
export async function focusMarkerForPreview(
  map: google.maps.Map,
  gmaps: GMaps,
  mapEl: HTMLElement,
  lat: number,
  lng: number,
  getTopInset: () => number,
  options?: { skipCamera?: boolean },
): Promise<void> {
  if (!options?.skipCamera) {
    await moveCameraToPoint(map, gmaps, lat, lng);
  }
  await panMarkerToPreviewAnchor(map, gmaps, mapEl, lat, lng, getTopInset);
}

export interface ClusterFocusResult {
  shouldSelect: boolean;
  resultZoom: number;
}

/** Zoom levels added per cluster / merged click — one level keeps nearby pins visible. */
const CLUSTER_ZOOM_STEP = 1;

/** Clusters never zoom past pin level so sibling issues stay on screen. */
const CLUSTER_EXPAND_MAX_ZOOM = DEFAULT_MAP_PIN_ZOOM;

async function moveCamera(
  map: google.maps.Map,
  gmaps: GMaps,
  lat: number,
  lng: number,
  targetZoom: number,
): Promise<number> {
  const currentZoom = map.getZoom() ?? DEFAULT_MAP_ZOOM;
  const zoom = Math.min(Math.max(targetZoom, currentZoom), MAP_CLUSTER_MAX_ZOOM);

  map.panTo({ lat, lng });
  if (zoom !== currentZoom) {
    map.setZoom(zoom);
  }

  await waitMapIdle(map, gmaps);

  const afterZoom = map.getZoom() ?? zoom;

  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8322dc'},body:JSON.stringify({sessionId:'8322dc',runId:'cluster-fix',hypothesisId:'H6',location:'mapFocus.ts:moveCamera',message:'camera applied',data:{lat,lng,currentZoom,targetZoom:zoom,afterZoom},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return afterZoom;
}

/** Step zoom toward a merged pin — +1 level per click, open preview at pin zoom. */
export async function stepZoomMergedMarker(
  map: google.maps.Map,
  gmaps: GMaps,
  lat: number,
  lng: number,
  _mergedCount: number,
): Promise<boolean> {
  const currentZoom = map.getZoom() ?? DEFAULT_MAP_ZOOM;
  const pinZoom = CLUSTER_EXPAND_MAX_ZOOM;

  if (currentZoom >= pinZoom) {
    return true;
  }

  const nextZoom = Math.min(currentZoom + CLUSTER_ZOOM_STEP, pinZoom);
  await moveCamera(map, gmaps, lat, lng, nextZoom);

  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8322dc'},body:JSON.stringify({sessionId:'8322dc',runId:'gentle-zoom',hypothesisId:'H7',location:'mapFocus.ts:stepZoomMergedMarker',message:'merged pin +1 step',data:{currentZoom,nextZoom,pinZoom,ready:nextZoom>=pinZoom},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return nextZoom >= pinZoom;
}

export async function focusCluster(
  map: google.maps.Map,
  gmaps: GMaps,
  cluster: Cluster,
): Promise<ClusterFocusResult> {
  const currentZoom = map.getZoom() ?? DEFAULT_MAP_ZOOM;
  const clusterMarkers = cluster.markers ?? [];
  const markerCount = cluster.count ?? clusterMarkers.length ?? 0;
  const position = cluster.position;
  const lat = position.lat();
  const lng = position.lng();

  const steppedZoom = Math.min(currentZoom + CLUSTER_ZOOM_STEP, CLUSTER_EXPAND_MAX_ZOOM);
  const resultZoom = await moveCamera(map, gmaps, lat, lng, steppedZoom);

  // Only open preview when one pin remains AND we've reached pin zoom — never jump zoom.
  const shouldSelect = markerCount <= 1 && resultZoom >= CLUSTER_EXPAND_MAX_ZOOM;

  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8322dc'},body:JSON.stringify({sessionId:'8322dc',runId:'gentle-zoom',hypothesisId:'H1',location:'mapFocus.ts:focusCluster',message:'cluster +1 step',data:{currentZoom,steppedZoom,resultZoom,markerCount,shouldSelect,clusterMax:CLUSTER_EXPAND_MAX_ZOOM},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return { shouldSelect, resultZoom };
}

export async function fitMapToMarkers(
  map: google.maps.Map,
  gmaps: GMaps,
  markers: Array<{ latitude: number; longitude: number }>,
): Promise<void> {
  if (!markers.length) return;

  if (markers.length === 1) {
    await moveCameraToPoint(map, gmaps, markers[0].latitude, markers[0].longitude);
    return;
  }

  const bounds = new gmaps.LatLngBounds();
  markers.forEach((marker) => {
    bounds.extend({ lat: marker.latitude, lng: marker.longitude });
  });
  map.fitBounds(bounds, 64);
  await waitMapIdle(map, gmaps);

  const resultZoom = map.getZoom();
  if (typeof resultZoom === 'number' && resultZoom > MAP_CLUSTER_MAX_ZOOM) {
    map.setZoom(MAP_CLUSTER_MAX_ZOOM);
    await waitMapIdle(map, gmaps);
  }
}

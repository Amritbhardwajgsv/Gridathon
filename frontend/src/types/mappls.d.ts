// Shared Mappls SDK types — imported by PersonnelMap and MapplsRouteMap

export interface MaplsMap {
  remove?:    () => void;
  destroy?:   () => void;
  setZoom?:   (z: number) => void;
  setCenter?: (center: [number, number]) => void;
  fitBounds?: (bounds: [[number, number], [number, number]]) => void;
}

export interface MaplsMarker {
  remove?:  () => void;
  setMap?:  (map: MaplsMap | null) => void;
}

declare global {
  interface Window {
    mappls?: {
      Map:       new (id: string, options: Record<string, unknown>) => MaplsMap;
      Marker:    new (options: Record<string, unknown>) => MaplsMarker;
      direction: (options: Record<string, unknown>) => void;
    };
    [key: `__mmap_${string}__`]:      (() => void) | undefined;
    [key: `__mappls_cb_${string}__`]: (() => void) | undefined;
  }
}

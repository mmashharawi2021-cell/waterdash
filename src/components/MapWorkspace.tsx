import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// @ts-ignore
import 'leaflet-draw';
// @ts-ignore
import 'leaflet-control-geocoder';
// @ts-ignore
import 'leaflet-routing-machine';
// @ts-ignore
import 'esri-leaflet';

export const BASEMAPS = {
  OpenStreetMap: {
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  Satellite: {
    label: 'Esri Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  Streets: {
    label: 'Esri Streets',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  Terrain: {
    label: 'Esri Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
};

interface MapControlsProps {
  onAddLayer: (layer: L.Layer, name: string) => void;
}

function MapControls({ onAddLayer }: MapControlsProps) {
  const map = useMap();

  useEffect(() => {
    // Add geocoder control
    // @ts-ignore
    const geocoderControl = L.Control.geocoder({ position: 'topright' }).addTo(map);

    // Draw tools
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // @ts-ignore
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: true,
        polygon: true,
        rectangle: true,
        circle: true,
        marker: true,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
      },
    });

    map.addControl(drawControl);

    const handleDrawCreated = (e: any) => {
      drawnItems.addLayer(e.layer);
      onAddLayer(e.layer, `Drawn ${e.layerType}`);
    };

    map.on('draw:created', handleDrawCreated);

    // @ts-ignore
    const geoControl = L.control({ position: 'bottomright' });
    geoControl.onAdd = () => {
      const container = L.DomUtil.create('div', 'geo-btn');
      container.innerHTML = '<button type="button">📍 Locate Me</button>';
      container.onclick = () => {
        map.locate({ setView: true, maxZoom: 16 });
      };
      return container;
    };
    geoControl.addTo(map);

    const handleLocationFound = (e: any) => {
      L.marker(e.latlng).addTo(map).bindPopup('You are here').openPopup();
    };

    map.on('locationfound', handleLocationFound);

    // Clean-up function to prevent memory leaks and duplicate UI overlays
    return () => {
      map.removeControl(geocoderControl);
      map.removeControl(drawControl);
      map.removeControl(geoControl);
      map.removeLayer(drawnItems);
      map.off('draw:created', handleDrawCreated);
      map.off('locationfound', handleLocationFound);
    };
  }, [map, onAddLayer]);

  return null;
}

interface MapRefSetterProps {
  onCreate: (map: L.Map) => void;
}

function MapRefSetter({ onCreate }: MapRefSetterProps) {
  const map = useMap();
  useEffect(() => {
    onCreate(map);
  }, [map, onCreate]);
  return null;
}

interface MapWorkspaceProps {
  basemap: 'OpenStreetMap' | 'Satellite' | 'Streets' | 'Terrain';
  mapRef: React.MutableRefObject<L.Map | null>;
  handleAddLayer: (layer: L.Layer, name: string) => void;
}

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  basemap,
  mapRef,
  handleAddLayer,
}) => {
  return (
    <div className="map-panel">
      <div className="map-toolbar">
        <div>
          <span className="map-badge">LIVE</span>
          <span>Interactive Map Workspace</span>
        </div>
        <div>
          <button>Preview</button>
          <button className="secondary">Export</button>
        </div>
      </div>
      <div className="builder-map-frame">
        <MapContainer
          center={[24.774265, 46.738586]}
          zoom={5}
          className="builder-map"
        >
          <MapRefSetter onCreate={(map) => (mapRef.current = map)} />
          <TileLayer
            key={basemap}
            attribution={BASEMAPS[basemap].attribution}
            url={BASEMAPS[basemap].url}
          />
          <MapControls onAddLayer={handleAddLayer} />
        </MapContainer>
      </div>
    </div>
  );
};

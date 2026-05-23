import { useCallback, useRef, useState } from 'react';
import L from 'leaflet';
// @ts-ignore
import shp from 'shpjs';
import { Sidebar } from './components/Sidebar';
import { MapWorkspace } from './components/MapWorkspace';
import { DashboardPanel } from './components/DashboardPanel';
import { ProjectStatus } from './components/ProjectStatus';
import './App.css';

const sampleProjects = [
  { project: 'Road Clearance', governorate: 'North Gaza', status: 'Active' },
  { project: 'Health Facilities', governorate: 'Gaza', status: 'Published' },
  { project: 'Water Distribution', governorate: 'Khan Yunis', status: 'Draft' },
  { project: 'Education Analytics', governorate: 'Middle', status: 'Active' },
];

function App() {
  const [basemap, setBasemap] = useState<'OpenStreetMap' | 'Satellite' | 'Streets' | 'Terrain'>(
    'OpenStreetMap'
  );
  const [layers, setLayers] = useState<
    Array<{ id: string; name: string; layer: L.Layer; visible: boolean }>
  >([]);
  const [projectName, setProjectName] = useState('Geo Canvas Builder');
  const [projectDescription, setProjectDescription] = useState(
    'Create premium map interfaces with advanced layers, data upload, and builder controls.'
  );
  const [esriUrl, setEsriUrl] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const mapRef = useRef<L.Map | null>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !mapRef.current) return;

    if (file.name.endsWith('.geojson')) {
      const text = await file.text();
      const geojson = JSON.parse(text);
      const layer = L.geoJSON(geojson, {
        style: { color: '#14b8a6', weight: 3 },
      }).addTo(mapRef.current);
      setLayers((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: file.name, layer, visible: true },
      ]);
      mapRef.current.fitBounds(layer.getBounds());
    } else if (file.name.endsWith('.zip')) {
      const arrayBuffer = await file.arrayBuffer();
      const geojson = await shp(arrayBuffer);
      const layer = L.geoJSON(geojson as any, {
        style: { color: '#f97316', weight: 2 },
      }).addTo(mapRef.current);
      setLayers((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: file.name, layer, visible: true },
      ]);
      mapRef.current.fitBounds(layer.getBounds());
    }

    event.target.value = '';
  }, []);

  const addEsriLayer = useCallback(() => {
    if (!esriUrl || !mapRef.current) return;
    // @ts-ignore
    const layer = L.esri.featureLayer({ url: esriUrl }).addTo(mapRef.current);
    setLayers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: 'Esri Layer', layer, visible: true },
    ]);
    setEsriUrl('');
  }, [esriUrl]);

  const handleAddLayer = useCallback((layer: L.Layer, name: string) => {
    setLayers((prev) => [...prev, { id: crypto.randomUUID(), name, layer, visible: true }]);
  }, []);

  const layerCount = layers.length;
  const activeLayerCount = layers.filter((item) => item.visible).length;
  
  const projectCards = [
    { title: 'Active Layers', value: activeLayerCount, color: 'blue' },
    { title: 'Uploaded Files', value: layerCount, color: 'teal' },
    { title: 'Map Widgets', value: 6, color: 'purple' },
    { title: 'Project Score', value: 'A+', color: 'gold' },
  ];

  const toggleLayer = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.visible) {
          item.layer.remove();
        } else if (mapRef.current) {
          item.layer.addTo(mapRef.current);
        }
        return { ...item, visible: !item.visible };
      })
    );
  }, []);

  const removeLayer = useCallback((id: string) => {
    setLayers((prev) => {
      const next = prev.filter((item) => {
        if (item.id === id) {
          item.layer.remove();
          return false;
        }
        return true;
      });
      return next;
    });
  }, []);

  const saveProject = useCallback(() => {
    localStorage.setItem(
      'geo-canvas-project',
      JSON.stringify({
        projectName,
        projectDescription,
        basemap,
        savedAt: new Date().toISOString(),
      })
    );
    setSaveMessage('Project saved in browser local storage.');
    setTimeout(() => setSaveMessage(''), 3000);
  }, [projectName, projectDescription, basemap]);

  const loadProject = useCallback(() => {
    const stored = localStorage.getItem('geo-canvas-project');
    if (!stored) return;
    const data = JSON.parse(stored);
    setProjectName(data.projectName || projectName);
    setProjectDescription(data.projectDescription || projectDescription);
    setBasemap(data.basemap || basemap);
    setSaveMessage('Project loaded from local storage.');
    setTimeout(() => setSaveMessage(''), 3000);
  }, [projectName, projectDescription, basemap]);

  return (
    <div className="builder-app">
      <Sidebar
        projectName={projectName}
        setProjectName={setProjectName}
        projectDescription={projectDescription}
        setProjectDescription={setProjectDescription}
        saveProject={saveProject}
        loadProject={loadProject}
        saveMessage={saveMessage}
        handleFileUpload={handleFileUpload}
        esriUrl={esriUrl}
        setEsriUrl={setEsriUrl}
        addEsriLayer={addEsriLayer}
        layers={layers}
        toggleLayer={toggleLayer}
        removeLayer={removeLayer}
      />

      <main className="builder-main">
        <section className="main-top">
          <MapWorkspace
            basemap={basemap}
            mapRef={mapRef}
            handleAddLayer={handleAddLayer}
          />
          <DashboardPanel projectCards={projectCards} />
        </section>

        <ProjectStatus
          layerCount={layerCount}
          sampleProjects={sampleProjects}
        />
      </main>
    </div>
  );
}

export default App;

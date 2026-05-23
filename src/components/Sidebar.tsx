import React from 'react';
import L from 'leaflet';

interface SidebarProps {
  projectName: string;
  setProjectName: (val: string) => void;
  projectDescription: string;
  setProjectDescription: (val: string) => void;
  saveProject: () => void;
  loadProject: () => void;
  saveMessage: string;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  esriUrl: string;
  setEsriUrl: (val: string) => void;
  addEsriLayer: () => void;
  layers: Array<{ id: string; name: string; layer: L.Layer; visible: boolean }>;
  toggleLayer: (id: string) => void;
  removeLayer: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projectName,
  setProjectName,
  projectDescription,
  setProjectDescription,
  saveProject,
  loadProject,
  saveMessage,
  handleFileUpload,
  esriUrl,
  setEsriUrl,
  addEsriLayer,
  layers,
  toggleLayer,
  removeLayer,
}) => {
  return (
    <aside className="builder-sidebar">
      <div className="brand-panel">
        <span className="logo">Geo Canvas</span>
        <p>{projectDescription}</p>
      </div>

      <section className="panel">
        <h3>Project Settings</h3>
        <label>Project Name</label>
        <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        <label>Project Description</label>
        <textarea
          value={projectDescription}
          onChange={(e) => setProjectDescription(e.target.value)}
          rows={3}
        />
        <div className="button-row">
          <button onClick={saveProject}>Save Project</button>
          <button className="secondary" onClick={loadProject}>
            Load
          </button>
        </div>
        {saveMessage && <div className="message">{saveMessage}</div>}
      </section>

      <section className="panel">
        <h3>Data & Layers</h3>
        <label>Upload GeoJSON / Shapefile</label>
        <input type="file" accept=".geojson,.zip" onChange={handleFileUpload} />
        <label>Esri Feature Service</label>
        <input
          value={esriUrl}
          placeholder="Paste Esri URL"
          onChange={(e) => setEsriUrl(e.target.value)}
        />
        <button onClick={addEsriLayer}>Add Esri Layer</button>
      </section>

      <section className="panel">
        <h3>Layer Manager</h3>
        <div className="layer-list">
          {layers.length === 0 && <p className="small-text">No active layers yet.</p>}
          {layers.map((item) => (
            <div key={item.id} className="layer-item">
              <span>{item.name}</span>
              <div>
                <button onClick={() => toggleLayer(item.id)}>
                  {item.visible ? 'Hide' : 'Show'}
                </button>
                <button className="danger" onClick={() => removeLayer(item.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
};

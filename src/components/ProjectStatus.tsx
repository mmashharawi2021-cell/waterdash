import React from 'react';

interface SampleProject {
  project: string;
  governorate: string;
  status: string;
}

interface ProjectStatusProps {
  layerCount: number;
  sampleProjects: SampleProject[];
}

export const ProjectStatus: React.FC<ProjectStatusProps> = ({
  layerCount,
  sampleProjects,
}) => {
  return (
    <section className="main-bottom">
      <div className="chart-panel">
        <h3>Project Status</h3>
        <div className="chart-grid">
          <div className="chart-card small">
            <h4>Completion</h4>
            <div className="chart-value">72%</div>
            <div className="chart-bar">
              <div style={{ width: '72%' }}></div>
            </div>
          </div>
          <div className="chart-card small">
            <h4>Layer Coverage</h4>
            <div className="chart-value">{layerCount * 10}%</div>
            <div className="chart-bar">
              <div style={{ width: `${Math.min(layerCount * 10, 100)}%` }}></div>
            </div>
          </div>
          <div className="chart-card medium">
            <h4>Latest Published Projects</h4>
            <ul>
              {sampleProjects.map((row) => (
                <li key={row.project}>
                  <strong>{row.project}</strong>
                  <span>
                    {row.governorate} · {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="table-panel">
        <h3>Recent Project Data</h3>
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Governorate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sampleProjects.map((row) => (
              <tr key={row.project}>
                <td>{row.project}</td>
                <td>{row.governorate}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

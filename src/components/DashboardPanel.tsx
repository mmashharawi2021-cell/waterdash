import React from 'react';

interface ProjectCard {
  title: string;
  value: string | number;
  color: string;
}

interface DashboardPanelProps {
  projectCards: ProjectCard[];
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ projectCards }) => {
  return (
    <aside className="dashboard-panel">
      <div className="dashboard-header">
        <h2>Project Overview</h2>
        <small>Live analytics for the map builder</small>
      </div>
      <div className="overview-cards">
        {projectCards.map((card) => (
          <div key={card.title} className={`overview-card ${card.color}`}>
            <span>{card.title}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>
      <div className="kpi-card">
        <h3>Main Insights</h3>
        <div className="kpi-grid">
          <div>
            <span>Total Length</span>
            <strong>58.18 km</strong>
          </div>
          <div>
            <span>Data Points</span>
            <strong>1,362</strong>
          </div>
          <div>
            <span>Active Widgets</span>
            <strong>12</strong>
          </div>
        </div>
      </div>
    </aside>
  );
};

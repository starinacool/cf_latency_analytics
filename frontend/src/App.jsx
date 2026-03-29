import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Activity,
  Clock,
  Search,
  Database,
  BarChart3,
  RefreshCw,
  Zap,
  ShieldCheck
} from 'lucide-react';
import Sidebar from './Sidebar';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const defaultMetrics = ['avg_edge', 'avg_origin', 'p_edge', 'p_origin', 'req_count'];

  // Initialize from URL search parameters
  const [activeFilters, setActiveFilters] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return {
      timeframe: query.get('timeframe') || 'day',
      interval: query.get('interval') || '',
      prefix: query.get('prefix') || '/api',
      cacheStatus: query.get('cacheStatus') || '',
      colo: query.get('colo') || '',
      country: query.get('country') || '',
      method: query.get('method') || '',
      host: query.get('host') || '',
      excludePrefix: query.get('excludePrefix') || '',
      groupByPath: query.get('groupByPath') === 'true',
      percentile: query.get('percentile') || '90',
      metrics: query.get('metrics') ? query.get('metrics').split(',') : defaultMetrics
    };
  });

  const [availableCacheStatuses, setAvailableCacheStatuses] = useState([]);

  // Initial fetch on mount
  useEffect(() => {
    fetchData(activeFilters);
  }, []);

  const fetchData = async (filters = activeFilters) => {
    // Sync state to URL
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'metrics') {
          if (value.length !== defaultMetrics.length || !defaultMetrics.every(m => value.includes(m))) {
            params.set(key, value.join(','));
          }
        } else {
          params.set(key, value);
        }
      }
    });

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/latency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filters),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      if (result.error) {
        throw new Error(result.error);
      }

      const zoneData = result.data.viewer.zones[0];
      setData(zoneData.httpRequestsAdaptiveGroups);
      setActiveFilters(filters);

      // Update available cache statuses from discovery query
      if (zoneData.discovery) {
        const statuses = zoneData.discovery.map(d => d.dimensions.cacheStatus).filter(Boolean);
        setAvailableCacheStatuses([...new Set(statuses)].sort());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Removed automatic refresh on input change to support "Update Data" button only
  // useEffect(() => {
  //   fetchData();
  // }, [timeframe, interval, cacheStatus, colo, country]);

  const processChartDataForGroup = (groupData) => {
    if (!groupData || groupData.length === 0) return null;

    const labels = groupData.map(item => {
      const dims = item.dimensions;
      const dt = dims.datetimeFiveMinutes ||
        dims.datetimeFifteenMinutes ||
        dims.datetimeHour ||
        dims.date ||
        dims.datetime;

      return new Date(dt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    const pVal = groupData.map(item => item.quantiles?.[`edgeTimeToFirstByteMsP${activeFilters.percentile}`] || 0);
    const originPVal = groupData.map(item => item.quantiles?.[`originResponseDurationMsP${activeFilters.percentile}`] || 0);
    const avgEdge = groupData.map(item => item.avg?.edgeTimeToFirstByteMs || 0);
    const avgOrigin = groupData.map(item => item.avg?.originResponseDurationMs || 0);
    const counts = groupData.map(item => item.count || 0);

    const allDatasets = [
      {
        id: 'avg_edge',
        label: 'Avg Edge TTFB (ms)',
        data: avgEdge,
        borderColor: 'rgba(217, 70, 239, 1)',
        backgroundColor: 'rgba(217, 70, 239, 0.1)',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderDash: [5, 5],
        yAxisID: 'y',
      },
      {
        id: 'avg_origin',
        label: 'Avg Origin Duration (ms)',
        data: avgOrigin,
        borderColor: 'rgba(245, 158, 11, 1)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderDash: [5, 5],
        yAxisID: 'y',
      },
      {
        id: 'p_edge',
        label: `P${activeFilters.percentile} Edge TTFB (ms)`,
        data: pVal,
        borderColor: 'rgba(168, 85, 247, 1)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        yAxisID: 'y',
      },
      {
        id: 'p_origin',
        label: `P${activeFilters.percentile} Origin Duration (ms)`,
        data: originPVal,
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        yAxisID: 'y',
      },
      {
        id: 'req_count',
        label: 'Request Count',
        data: counts,
        borderColor: 'rgba(59, 130, 246, 0.5)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        yAxisID: 'y1',
        borderWidth: 1,
      }
    ];

    return {
      labels,
      datasets: allDatasets.filter(ds => activeFilters.metrics.includes(ds.id)).map(({ id, ...rest }) => rest)
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#94a3b8', font: { family: 'Inter' } }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b' },
        title: { display: true, text: 'Latency (ms)', color: '#64748b' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: { color: '#64748b' },
        title: { display: true, text: 'Request Count', color: '#64748b' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
      }
    }
  };

  // Stats removed since it is now card-specific

  return (
    <div className="dashboard-container">
      <Sidebar
        initialFilters={activeFilters}
        availableCacheStatuses={availableCacheStatuses}
        onUpdate={fetchData}
        loading={loading}
      />

      <div className="main-content">
        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '0.75rem', color: '#ef4444', marginBottom: '1rem' }}>
            Error: {error}. Check your API Token and Zone ID in Worker secrets.
          </div>
        )}

        {(() => {
          const renderChartCard = (title, groupData) => {
            const groupStats = groupData && groupData.length > 0 ? {
              avgPVal: Math.round(groupData.reduce((acc, curr) => acc + (curr.quantiles?.[`edgeTimeToFirstByteMsP${activeFilters.percentile}`] || 0), 0) / groupData.length) || 0,
              avgOriginPVal: Math.round(groupData.reduce((acc, curr) => acc + (curr.quantiles?.[`originResponseDurationMsP${activeFilters.percentile}`] || 0), 0) / groupData.length) || 0,
              totalRequests: groupData.reduce((acc, curr) => acc + (curr.count || 0), 0),
            } : null;

            return (
              <div className="card" key={title} style={{ marginBottom: '2rem' }}>
                <div className="card-title">
                  <Activity color="#3b82f6" /> {title}
                </div>

                <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                  <div className="metric-card">
                    <div className="metric-label">Total Requests</div>
                    <div className="metric-value" style={{ color: '#3b82f6' }}>{groupStats ? groupStats.totalRequests.toLocaleString() : '--'}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Avg P{activeFilters.percentile} Edge</div>
                    <div className="metric-value" style={{ color: '#a855f7' }}>{groupStats ? `${groupStats.avgPVal}ms` : '--'}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Avg P{activeFilters.percentile} Origin</div>
                    <div className="metric-value" style={{ color: '#10b981' }}>{groupStats ? `${groupStats.avgOriginPVal}ms` : '--'}</div>
                  </div>
                </div>

                <div className="chart-container">
                  {loading ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RefreshCw className="animate-spin" size={48} color="#3b82f6" />
                    </div>
                  ) : groupData && groupData.length > 0 ? (
                    <Line data={processChartDataForGroup(groupData)} options={chartOptions} />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      No data available for this timeframe/prefix
                    </div>
                  )}
                </div>
              </div>
            );
          };

          if (!data || data.length === 0) {
            return renderChartCard("Edge Latency Dynamics", []);
          }

          if (activeFilters.groupByPath) {
            const groups = {};
            data.forEach(item => {
              const path = item.dimensions?.clientRequestPath || 'Unknown Path';
              if (!groups[path]) groups[path] = [];
              groups[path].push(item);
            });
            const paths = Object.keys(groups).sort((a, b) => {
              const countA = groups[a].reduce((acc, curr) => acc + (curr.count || 0), 0);
              const countB = groups[b].reduce((acc, curr) => acc + (curr.count || 0), 0);
              return countB - countA;
            });
            return paths.map(path => renderChartCard(path, groups[path]));
          } else {
            return renderChartCard("Edge Latency Dynamics", data);
          }
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="card">
            <div className="card-title"><Database color="#10b981" /> Data Sources</div>
            <p style={{ color: '#94a3b8', lineHeight: '1.5' }}>
              Fetching from <code>httpRequestsAdaptiveGroups</code> dataset via Cloudflare GraphQL API.
              Supports dynamic granularity from 5 minutes to 1 day.
            </p>
          </div>
          <div className="card">
            <div className="card-title"><Zap color="#6366f1" /> Fast Insights</div>
            <p style={{ color: '#94a3b8', lineHeight: '1.5' }}>
              Real-time grouping by <code>cacheStatus</code> allows you to differentiate between edge performance
              and origin response times directly from the dashboard.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;

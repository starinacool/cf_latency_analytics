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

  // Initialize from URL search parameters
  const query = new URLSearchParams(window.location.search);
  const [timeframe, setTimeframe] = useState(query.get('timeframe') || 'day');
  const [interval, setInterval] = useState(query.get('interval') || '');
  const [prefix, setPrefix] = useState(query.get('prefix') || '/api');
  const [cacheStatus, setCacheStatus] = useState(query.get('cacheStatus') || '');
  const [colo, setColo] = useState(query.get('colo') || '');
  const [country, setCountry] = useState(query.get('country') || '');
  const [method, setMethod] = useState(query.get('method') || '');
  const [host, setHost] = useState(query.get('host') || '');
  const [excludePrefix, setExcludePrefix] = useState(query.get('excludePrefix') || '');
  const [groupByPath, setGroupByPath] = useState(query.get('groupByPath') === 'true');
  const [percentile, setPercentile] = useState(query.get('percentile') || '90');
  const [chartConfig, setChartConfig] = useState({
    groupByPath: query.get('groupByPath') === 'true',
    percentile: query.get('percentile') || '90'
  });
  const [availableCacheStatuses, setAvailableCacheStatuses] = useState([]);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (timeframe) params.set('timeframe', timeframe);
    if (interval) params.set('interval', interval);
    if (prefix) params.set('prefix', prefix);
    if (cacheStatus) params.set('cacheStatus', cacheStatus);
    if (colo) params.set('colo', colo);
    if (country) params.set('country', country);
    if (method) params.set('method', method);
    if (host) params.set('host', host);
    if (excludePrefix) params.set('excludePrefix', excludePrefix);
    if (groupByPath) params.set('groupByPath', groupByPath);
    if (percentile) params.set('percentile', percentile);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [timeframe, interval, prefix, cacheStatus, colo, country, method, host, excludePrefix, groupByPath, percentile]);

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/latency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeframe,
          interval: interval || null,
          prefix,
          cacheStatus: cacheStatus || null,
          colo: colo || null,
          country: country || null,
          method: method || null,
          host: host || null,
          excludePrefix: excludePrefix || null,
          groupByPath,
          percentile
        }),
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
      setChartConfig({ groupByPath, percentile });

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

    const pVal = groupData.map(item => item.quantiles[`edgeTimeToFirstByteMsP${chartConfig.percentile}`]);
    const originPVal = groupData.map(item => item.quantiles[`originResponseDurationMsP${chartConfig.percentile}`]);
    const avgEdge = groupData.map(item => item.avg?.edgeTimeToFirstByteMs || 0);
    const avgOrigin = groupData.map(item => item.avg?.originResponseDurationMs || 0);
    const counts = groupData.map(item => item.count || 0);

    return {
      labels,
      datasets: [
        {
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
          label: `P${chartConfig.percentile} Edge TTFB (ms)`,
          data: pVal,
          borderColor: 'rgba(168, 85, 247, 1)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
          label: `P${chartConfig.percentile} Origin Duration (ms)`,
          data: originPVal,
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
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
      ]
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
      <div className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <ShieldCheck color="#3b82f6" size={32} />
          <h2 style={{ fontSize: '1.25rem' }}>CF Analytics</h2>
        </div>

        <div className="input-group">
          <label>Timeframe</label>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="10days">Last 10 Days</option>
            <option value="2weeks">Last 14 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>

        <div className="input-group">
          <label>Percentile</label>
          <select value={percentile} onChange={(e) => setPercentile(e.target.value)}>
            <option value="50">P50 (Median)</option>
            <option value="75">P75</option>
            <option value="90">P90</option>
            <option value="95">P95</option>
            <option value="99">P99</option>
          </select>
        </div>

        <div className="input-group">
          <label>Interval</label>
          <select value={interval} onChange={(e) => setInterval(e.target.value)}>
            <option value="">Auto (Default)</option>
            <option value="5m">5 Minutes</option>
            <option value="15m">15 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="3h">3 Hours</option>
            <option value="1d">1 Day</option>
          </select>
        </div>

        <div className="input-group">
          <label>Path</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              style={{ paddingLeft: '2.5rem' }}
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="/api/%user%"
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            />
          </div>
        </div>

        <div className="input-group">
          <label>Exclude Path</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              style={{ paddingLeft: '2.5rem' }}
              type="text"
              value={excludePrefix}
              onChange={(e) => setExcludePrefix(e.target.value)}
              placeholder="/api/%new%"
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            />
          </div>
        </div>

        <div className="input-group">
          <label>Request Host</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="example.com"
          />
        </div>

        <div className="input-group">
          <label>Cache Status</label>
          <select value={cacheStatus} onChange={(e) => setCacheStatus(e.target.value)}>
            <option value="">All Traffic</option>
            {availableCacheStatuses.map(status => (
              <option key={status} value={status}>{status.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>HTTP Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>
        </div>

        <div className="input-group">
          <label>Data Center (IATA)</label>
          <input
            type="text"
            value={colo}
            onChange={(e) => setColo(e.target.value.toUpperCase())}
            placeholder="e.g. SFO, LHR"
          />
        </div>

        <div className="input-group">
          <label>Country (ISO)</label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder="e.g. US, GB"
          />
        </div>

        <div className="input-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={groupByPath}
              onChange={(e) => setGroupByPath(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            Group by Endpoint
          </label>
        </div>

        <button className="btn" onClick={fetchData} disabled={loading}>
          {loading ? <RefreshCw className="animate-spin" size={20} /> : 'Update Data'}
        </button>

        <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: '#64748b' }}>
          Deployed on Cloudflare Workers
        </div>
      </div>

      <div className="main-content">
        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '0.75rem', color: '#ef4444', marginBottom: '1rem' }}>
            Error: {error}. Check your API Token and Zone ID in Worker secrets.
          </div>
        )}

        {(() => {
          const renderChartCard = (title, groupData) => {
            const groupStats = groupData && groupData.length > 0 ? {
              avgPVal: Math.round(groupData.reduce((acc, curr) => acc + (curr.quantiles[`edgeTimeToFirstByteMsP${chartConfig.percentile}`] || 0), 0) / groupData.length) || 0,
              avgOriginPVal: Math.round(groupData.reduce((acc, curr) => acc + (curr.quantiles[`originResponseDurationMsP${chartConfig.percentile}`] || 0), 0) / groupData.length) || 0,
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
                    <div className="metric-label">Avg P{chartConfig.percentile} Edge</div>
                    <div className="metric-value" style={{ color: '#a855f7' }}>{groupStats ? `${groupStats.avgPVal}ms` : '--'}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Avg P{chartConfig.percentile} Origin</div>
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

          if (chartConfig.groupByPath) {
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

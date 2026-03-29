import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';

const availableMetricsOptions = [
  { id: 'avg_edge', label: 'Avg Edge TTFB' },
  { id: 'avg_origin', label: 'Avg Origin Duration' },
  { id: 'p_edge', label: 'P(xx) Edge TTFB' },
  { id: 'p_origin', label: 'P(xx) Origin Duration' },
  { id: 'req_count', label: 'Request Count' }
];

const Sidebar = ({ initialFilters, availableCacheStatuses, onUpdate, loading }) => {
  const [timeframe, setTimeframe] = useState(initialFilters.timeframe || 'day');
  const [interval, setInterval] = useState(initialFilters.interval || '');
  const [prefix, setPrefix] = useState(initialFilters.prefix || '/api%');
  const [cacheStatus, setCacheStatus] = useState(initialFilters.cacheStatus || '');
  const [colo, setColo] = useState(initialFilters.colo || '');
  const [country, setCountry] = useState(initialFilters.country || '');
  const [method, setMethod] = useState(initialFilters.method || '');
  const [host, setHost] = useState(initialFilters.host || '');
  const [excludePrefix, setExcludePrefix] = useState(initialFilters.excludePrefix || '');
  const [groupByPath, setGroupByPath] = useState(initialFilters.groupByPath || false);
  const [percentile, setPercentile] = useState(initialFilters.percentile || '90');
  const [selectedMetrics, setSelectedMetrics] = useState(initialFilters.metrics || []);

  const handleUpdate = () => {
    onUpdate({
      timeframe,
      interval,
      prefix,
      cacheStatus,
      colo,
      country,
      method,
      host,
      excludePrefix,
      groupByPath,
      percentile,
      metrics: selectedMetrics
    });
  };

  return (
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
        <label>Metrics to Display</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
          {availableMetricsOptions.map(metric => (
            <label key={metric.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={selectedMetrics.includes(metric.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedMetrics([...selectedMetrics, metric.id]);
                  } else {
                    setSelectedMetrics(selectedMetrics.filter(id => id !== metric.id));
                  }
                }}
                style={{ width: 'auto', margin: 0 }}
              />
              {metric.label.replace('P(xx)', `P${percentile}`)}
            </label>
          ))}
        </div>
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
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
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
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
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

      <button className="btn" onClick={handleUpdate} disabled={loading}>
        {loading ? <RefreshCw className="animate-spin" size={20} /> : 'Update Data'}
      </button>

      <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: '#64748b' }}>
        Deployed on Cloudflare Workers
      </div>
    </div>
  );
};

export default Sidebar;

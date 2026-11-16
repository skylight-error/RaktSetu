/**
 * RaktSetu Standalone SVG Chart Engine
 * Completely offline, zero external dependencies, highly responsive & reactive
 */
const Charts = {
  /**
   * Forecast Line & Confidence Corridor Area Chart
   */
  renderForecastChart(containerId, forecastData, recentHistory = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = 240;
    const padding = { top: 25, right: 30, bottom: 35, left: 45 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Combine recent history (last 5 days) and forecast (7 days)
    const historyPoints = recentHistory.slice(-5).map(d => ({
      label: d.date.slice(5),
      value: d.actualUnits,
      isForecast: false,
      date: d.date
    }));

    const forecastPoints = forecastData.map(d => ({
      label: d.dayName.slice(0, 3) + ' ' + d.date.slice(8),
      value: d.predictedUnits,
      lower: d.lowerBound,
      upper: d.upperBound,
      isForecast: true,
      date: d.date
    }));

    const allPoints = [...historyPoints, ...forecastPoints];
    if (allPoints.length === 0) return;

    const maxVal = Math.max(8, ...allPoints.map(p => (p.upper !== undefined ? p.upper : p.value))) + 1;
    const minVal = 0;

    const getX = index => padding.left + (index / (allPoints.length - 1)) * chartWidth;
    const getY = val => padding.top + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;

    // Build Confidence Corridor Polygon for forecast points
    const startIndex = historyPoints.length;
    let corridorPath = '';
    if (forecastPoints.length > 0) {
      const topCoords = [];
      const bottomCoords = [];
      forecastPoints.forEach((p, idx) => {
        const x = getX(startIndex + idx);
        topCoords.push(`${x},${getY(p.upper)}`);
        bottomCoords.unshift(`${x},${getY(p.lower)}`);
      });
      corridorPath = `M ${topCoords.join(' L ')} L ${bottomCoords.join(' L ')} Z`;
    }

    // Build History Line
    let historyPath = '';
    if (historyPoints.length > 0) {
      historyPath = historyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(p.value)}`).join(' ');
    }

    // Build Forecast Line (connects from last history point if available)
    let forecastLinePath = '';
    const forecastLineCoords = [];
    if (historyPoints.length > 0) {
      const lastHist = historyPoints[historyPoints.length - 1];
      forecastLineCoords.push(`${getX(historyPoints.length - 1)},${getY(lastHist.value)}`);
    }
    forecastPoints.forEach((p, idx) => {
      forecastLineCoords.push(`${getX(startIndex + idx)},${getY(p.value)}`);
    });
    if (forecastLineCoords.length > 0) {
      forecastLinePath = `M ${forecastLineCoords.join(' L ')}`;
    }

    // Horizontal grid lines
    const gridYValues = [0, Math.round(maxVal / 2), maxVal];
    const gridLines = gridYValues.map(v => `
      <line x1="${padding.left}" y1="${getY(v)}" x2="${padding.left + chartWidth}" y2="${getY(v)}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3"/>
      <text x="${padding.left - 8}" y="${getY(v) + 4}" fill="#64748b" font-size="11" text-anchor="end">${v}</text>
    `).join('');

    // X-Axis Labels
    const xLabels = allPoints.map((p, i) => {
      if (i % 2 === 0 || i === allPoints.length - 1) {
        return `<text x="${getX(i)}" y="${padding.top + chartHeight + 18}" fill="${p.isForecast ? '#991b1b' : '#64748b'}" font-size="10" font-weight="${p.isForecast ? '600' : '400'}" text-anchor="middle">${p.label}</text>`;
      }
      return '';
    }).join('');

    // Points
    const pointsMarkup = allPoints.map((p, i) => `
      <circle cx="${getX(i)}" cy="${getY(p.value)}" r="4" fill="${p.isForecast ? '#dc2626' : '#2563eb'}" stroke="#ffffff" stroke-width="2"/>
      <title>${p.date}: ${p.value} units ${p.isForecast ? `(Predicted, range ${p.lower}-${p.upper})` : '(Actual historical demand)'}</title>
    `).join('');

    container.innerHTML = `
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" class="chart-svg">
        <!-- Grid -->
        ${gridLines}

        <!-- 90% Confidence Corridor -->
        ${corridorPath ? `<path d="${corridorPath}" fill="rgba(220, 38, 38, 0.12)"/>` : ''}

        <!-- Divider line separating history & forecast -->
        ${historyPoints.length > 0 ? `
          <line x1="${getX(startIndex)}" y1="${padding.top}" x2="${getX(startIndex)}" y2="${padding.top + chartHeight}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>
          <text x="${getX(startIndex) + 6}" y="${padding.top + 12}" fill="#dc2626" font-size="10" font-weight="700">7-DAY AI FORECAST →</text>
        ` : ''}

        <!-- Historical Path -->
        ${historyPath ? `<path d="${historyPath}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>` : ''}

        <!-- Forecast Path -->
        <path d="${forecastLinePath}" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="5,3" stroke-linecap="round"/>

        <!-- Interactive Points -->
        ${pointsMarkup}

        <!-- X Labels -->
        ${xLabels}
      </svg>
    `;
  },

  /**
   * Rounded Bar Chart for Stock by Blood Group
   */
  renderBarChart(containerId, data, { xKey = 'blood_group', yKey = 'units' } = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = container.clientWidth || 340;
    const height = 180;
    const padding = { top: 20, right: 15, bottom: 25, left: 35 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxVal = Math.max(6, ...data.map(d => d[yKey])) + 1;
    const barWidth = Math.min(26, (chartWidth / data.length) * 0.65);
    const gap = chartWidth / data.length;

    const bars = data.map((d, i) => {
      const val = d[yKey];
      const barHeight = (val / maxVal) * chartHeight;
      const x = padding.left + i * gap + (gap - barWidth) / 2;
      const y = padding.top + chartHeight - barHeight;
      const color = val <= 2 ? '#dc2626' : (val <= 4 ? '#d97706' : '#059669');

      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${color}" opacity="0.9">
          <title>${d[xKey]}: ${val} units</title>
        </rect>
        <text x="${x + barWidth / 2}" y="${y - 4}" fill="#475569" font-size="10" font-weight="600" text-anchor="middle">${val}</text>
        <text x="${x + barWidth / 2}" y="${padding.top + chartHeight + 16}" fill="#0f172a" font-size="11" font-weight="600" text-anchor="middle">${d[xKey]}</text>
      `;
    }).join('');

    container.innerHTML = `
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}">
        <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight}" stroke="#cbd5e1" stroke-width="1.5"/>
        ${bars}
      </svg>
    `;
  },

  /**
   * Risk Meter Badge HTML generator
   */
  getRiskBadgeHtml(level) {
    const configs = {
      CRITICAL: { bg: '#fee2e2', color: '#991b1b', border: '#f87171', label: 'CRITICAL RISK', desc: 'Imminent Stockout Threat' },
      HIGH: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: 'HIGH SHORTAGE RISK', desc: 'Mobilisation Advised' },
      MEDIUM: { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: 'MEDIUM RISK', desc: 'Close Watch' },
      LOW: { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'ADEQUATE STOCK', desc: 'Normal Operations' }
    };
    const c = configs[level] || configs.LOW;
    return `
      <span class="risk-badge" style="background:${c.bg}; color:${c.color}; border:1px solid ${c.border};">
        <span class="risk-dot" style="background:${c.color};"></span>
        ${c.label}
      </span>
    `;
  }
};

window.Charts = Charts;

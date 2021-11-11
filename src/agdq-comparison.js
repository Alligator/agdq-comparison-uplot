import { nextColor } from './color';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css'

let donationsOrViewers = 'donations';
let uplot;
let marathonColours = {};
let highlightedMarathon;

window.addEventListener('load', async () => {
  const response = await fetch('out.json');
  const data = await response.json();

  data.marathons.forEach((marathon) => {
    marathonColours[marathon] = nextColor();
  });
  highlightedMarathon = data.marathons[data.marathons.length - 1];

  drawGraph(data);
  drawOtherStats(data);

  document.querySelectorAll('input[name=dorv]').forEach((el) => {
    if (el.checked) {
      donationsOrViewers = el.value;
    }

    el.addEventListener('change', (evt) => {
      donationsOrViewers = evt.target.value;
      const series = getSeries(data);
      uplot.setData(series, false);
      uplot.redraw();
    });
  });
});

function getSeries({ ts, viewers, donations }) {
  const series = donationsOrViewers === 'donations' ? donations : viewers;
  return [ts, ...series];
}

function drawGraph({ ts, viewers, donations, marathons }) {
  const series = getSeries({ ts, viewers, donations });

  const valueFormatter = (rawValue) => {
    if (donationsOrViewers === 'donations') {
      return rawValue ? '$' + uPlot.fmtNum(rawValue) : rawValue;
    } else {
      return uPlot.fmtNum(rawValue);
    }
  };

  const seriesOpts = marathons.map((name) => ({
    label: name,
    stroke: name === highlightedMarathon ? '#ccc' : marathonColours[name],
    width: name === highlightedMarathon ? 2.5 : 1.5,
    paths: uPlot.paths.spline(),
    value: (self, rawvalue) => valueFormatter(rawvalue),
  }));

  const opts = {
    id: "chart1",
    class: "gdq-comparison",
    width: window.innerWidth - 30,
    height: window.innerHeight - 110,
    plugins: [tooltipsPlugin({ valueFormatter })],
    legend: {
      show: false,
    },
    series: [
      {
        value: '{WWW} {HH}:{mm} {aa}',
      },
      ...seriesOpts,
    ],
    axes: [
      {
        stroke: '#ccc',
        font: '12px Inter',
        grid: { stroke: '#333333' },
        ticks: { stroke: '#bbbbbb' },
        values: '{WWW} {HH}:{mm} {aa}',
        space: 100,
      },
      {
        stroke: '#ccc',
        font: '12px Inter',
        grid: { stroke: '#333333' },
        ticks: { stroke: '#bbbbbb' },
        size: 80,
        values: (self, ticks) => ticks.map(valueFormatter),
      },
    ],
  };

  const el = document.getElementById('main-chart');
  uplot = new uPlot(opts, series, el);
}

function tooltipsPlugin(opts) {
  function init(u, opts, data) {
    let over = u.over;

    let tooltip = u.cursorTooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.position = 'absolute';
    tooltip.style.background = 'rgba(0, 0, 0, 0.85)';
    tooltip.style.borderRadius = '4px';
    tooltip.style.padding = '4px 8px 8px 8px';
    tooltip.style.display = 'none';
    over.appendChild(tooltip);

    over.addEventListener("mouseleave", () => {
      if (!u.cursor._lock) {
        tooltip.style.display = 'none';
      }
    });

    over.addEventListener("mouseenter", () => {
      tooltip.style.display = null;
    });
  }

  function setCursor(u) {
    const { idx } = u.cursor;

    const values = [];
    u.series.forEach((series, i) => {
      if (i === 0)
        return;

      if (series.show) {
        const val = u.data[i][idx]
        values.push({ series, val });
      }
    });

    values.sort((a, b) => b.val - a.val);

    const ts = u.series[0].value(u.series[0], u.data[0][idx])
    const tooltipContent = [ts];
    values.forEach(({ series, val }) => {
      const formattedVal = val ? opts.valueFormatter(val) : 'N/A';
      const highlight = series.width === 3;
      tooltipContent.push(`<span style="color: ${series._stroke};${highlight ? 'font-weight: bold' : ''}">${series.label}: ${formattedVal}</span>`);
    });

    u.cursorTooltip.innerHTML = tooltipContent.join('<br />');
  }

  return {
    hooks: {
      init,
      setCursor,
    },
  };
}

function drawOtherStats({ other_stats }) {
  const el = document.getElementById('other-stats');

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <th>marathon</th>
      <th>donation total</th>
      <th>peak viewers</th>
      <th>time of peak viewers</th>
      <th>game at peak viewers</th>
    </thead>`;
  
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  const dateFormatter = uPlot.fmtDate('{WWW} {HH}:{mm} {aa}');
  other_stats.forEach((row) => {
    const tr = document.createElement('tr');

    const ts = dateFormatter(new Date(row.max_viewers_ts * 1000));
    const color = row.name === highlightedMarathon ? 'white' : marathonColours[row.name];

    tr.innerHTML = `
      <td style="color:${color}">${row.name}</td>
      <td>$${row.max_donations.toLocaleString()}</td>
      <td>${row.max_viewers.toLocaleString()}</td>
      <td>${ts}</td>
      <td>${row.max_viewers_game}</td>`;
    tbody.appendChild(tr);
  });
  
  el.appendChild(table);
}

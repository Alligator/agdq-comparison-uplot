import { nextColor } from './color';
import marathonJson from './marathons-dev.json';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css'

const marathonNames = Object.keys(marathonJson);
// reverse to put the most recent ones last.
// if Object.keys stops returning the keys in the same order as the JSON this
// won't work...
marathonNames.reverse();

const rootTimestamp =  new Date(2021, 6, 4, 12, 0).getTime() / 1000;

let donationsOrViewers = 'donations';
let uplot;

function loadMarathons() {
  return Promise.all(marathonNames.map(async (marathonName) => {
    const data = await loadMarathon(marathonName);
    return { name: marathonName, data };
  }));
}

async function loadMarathon(name) {
  const url = marathonJson[name].url;
  const response = await fetch(url);
  if (response.ok) {
    const json = await response.json();
    return json.viewers;
  } else {
    return null;
  }
}

window.addEventListener('load', async () => {
  document.querySelectorAll('input[name=dorv]').forEach((el) => {
    if (el.checked) {
      donationsOrViewers = el.value;
    }

    el.addEventListener('change', (evt) => {
      donationsOrViewers = evt.target.value;
      const series = createSeries(marathonData);
      uplot.setData(series, false);
      uplot.redraw();
    });
  });

  const marathonData = await loadMarathons();
  const series = createSeries(marathonData);
  drawGraph(series);

});

function createSeries(marathons) {
  const bucketSize = donationsOrViewers === 'donations' ? 5 : 15; // in minutes
  const bucketCount = (24 * 60 * 7) / bucketSize;

  // weird fill + map needed so each entry is a _different_ array instance
  const series = new Array(marathons.length + 1)
    .fill(0)
    .map(() => new Array(bucketCount).fill(null));

  // every 5 minutes for a week. 2016 = # of 5 min chunks in a week
  for (let i = 0; i < bucketCount; i++) {
    const minuteOffset = i * bucketSize;
    const timestamp = rootTimestamp + (minuteOffset * 60);
    series[0][i] = timestamp;
  }

  marathons.forEach((marathon, idx) => {
    const startTs = new Date(marathonJson[marathon.name].start).getTime() / 1000;

    // we except one data point per minute of a week. if this marthon has more,
    // offset so we ignore the ones before
    const marathonDataOffset = marathon.data.length - (7 * 24 * 60);

    let prevValue = 0;
    let lastValue = 0;
    let lastValueIndex = null;

    for (let i = 0; i < bucketCount; i++) {
      const minuteOffset = i * bucketSize;
      const dataPoint = marathon.data[minuteOffset + marathonDataOffset];
      if (dataPoint) {
        const dataTs = Math.floor((dataPoint[0] - startTs) / 60 / bucketSize);
        if (donationsOrViewers === 'donations') {
          series[idx + 1][dataTs] = dataPoint[2];
          if (typeof dataPoint[2] === 'number') {
            lastValue = dataPoint[2];
            lastValueIndex = dataTs;
          }
        } else {
          const value = dataPoint[1] || 0;
          // disregard any value that's a 50% change from the previouw.
          if (Math.abs(prevValue - value) > (prevValue / 2)) {
            series[idx + 1][dataTs] = null;
          } else {
            series[idx + 1][dataTs] = dataPoint[1];
            if (typeof dataPoint[1] === 'number') {
              lastValue = dataPoint[1];
              lastValueIndex = dataTs;
            }
          }
          prevValue = value;
        }
      }
    }

    // fill out any points from the end back that are null
    // unless the marathon started < 7 days ago
    if ((new Date().getTime() / 1000) - startTs > (7 * 24 * 60 * 60)) {
      for (let i = lastValueIndex; i < bucketCount; i++) {
        series[idx + 1][i] = lastValue;
      }
    }
  });

  return series;
}

function drawGraph(series) {
  const valueFormatter = (rawValue) => {
    if (donationsOrViewers === 'donations') {
      return rawValue ? '$' + uPlot.fmtNum(rawValue) : rawValue;
    } else {
      return uPlot.fmtNum(rawValue);
    }
  };

  const seriesOpts = marathonNames.map((name) => ({
    label: name,
    stroke: marathonJson[name].highlight ? 'white' : nextColor(),
    width: marathonJson[name].highlight ? 2.5 : 1.5,
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
        stroke: 'white',
        grid: { stroke: '#333333' },
        ticks: { stroke: '#bbbbbb' },
        values: '{WWW} {HH}:{mm} {aa}',
        space: 100,
      },
      {
        stroke: 'white',
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
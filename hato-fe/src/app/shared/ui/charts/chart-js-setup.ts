import { Chart, registerables } from 'chart.js';

let chartJsRegistered = false;

export function ensureChartJsRegistered() {
  if (chartJsRegistered) {
    return;
  }

  Chart.register(...registerables);
  chartJsRegistered = true;
}

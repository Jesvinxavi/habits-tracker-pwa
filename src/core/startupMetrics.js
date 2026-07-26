const timings = {};

export function markStartup(name) {
  if (typeof performance === 'undefined') return;
  timings[name] = Math.round(performance.now());
  document.documentElement.dataset.startupTimings = JSON.stringify(timings);
}

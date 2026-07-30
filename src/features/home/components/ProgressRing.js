export function getProgressColor(pct) {
  if (pct < 34)
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--danger-color').trim() ||
      '#ff3b30'
    );
  if (pct < 67)
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--warning-color').trim() ||
      '#ff9500'
    );
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--success-color').trim() ||
    '#34c759'
  );
}

export function updateProgressRing(percentage) {
  const ring = document.querySelector('.progress-ring-fg');
  const progressNumber = document.querySelector('.progress-number');
  const container = document.querySelector('.progress-ring-container');
  if (!ring || !progressNumber) return;
  const radius = ring.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = getProgressColor(percentage);
  const roundedPercentage = Math.round(percentage);
  progressNumber.textContent = `${roundedPercentage}%`;
  container?.setAttribute('aria-label', `Daily progress: ${roundedPercentage}% complete`);
}

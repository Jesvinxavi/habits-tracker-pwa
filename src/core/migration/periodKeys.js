const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isoWeekMonday(year, week) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - day + 1 + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

export function periodSortDate(periodKey, fallbackDate) {
  if (DATE_PATTERN.test(periodKey)) return periodKey;
  let match = /^(\d{4})-W(\d{1,2})$/.exec(periodKey);
  if (match) return isoWeekMonday(Number(match[1]), Number(match[2]));
  match = /^(\d{4})-BW(\d{1,2})$/.exec(periodKey);
  if (match) return isoWeekMonday(Number(match[1]), Number(match[2]));
  match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) {
    return `${match[1]}-${match[2]}-01`;
  }
  if (/^\d{4}$/.test(periodKey)) return `${periodKey}-01-01`;
  const fallback = String(fallbackDate || '').slice(0, 10);
  return DATE_PATTERN.test(fallback) ? fallback : '1970-01-01';
}

export function isRecognizedPeriodKey(periodKey) {
  return (
    DATE_PATTERN.test(periodKey) ||
    /^\d{4}-W\d{1,2}$/.test(periodKey) ||
    /^\d{4}-BW\d{1,2}$/.test(periodKey) ||
    /^\d{4}-\d{2}$/.test(periodKey) ||
    /^\d{4}$/.test(periodKey)
  );
}

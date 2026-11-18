const months = 'january february march april may june july august september october november december'.split(' ');
const abbreviations = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

export function calendarMonth(word: string) {
  const key = word.toLowerCase();
  const full = months.indexOf(key);
  if (full >= 0) return full;
  const short = key.replace(/\.$/u, '');
  return short === 'sept' ? 8 : abbreviations.indexOf(short);
}

// The most specific date component heads the expression: day, or month when no day is present.
export function calendarDateHead(words: readonly string[]): number | undefined {
  const iso = words.length === 1 && /^([1-9]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u.exec(words[0]);
  if (iso) return calendarDateHead([iso[3], months[Number(iso[2]) - 1], iso[1]]) !== undefined ? 0 : undefined;
  const parts = words.filter(word => word !== ',');
  if (parts.length < 2 || parts.length > 3) return;
  const month = calendarMonth(parts[0]);
  const monthAfterDay = calendarMonth(parts[1]);
  if (month < 0 && monthAfterDay < 0) return;
  if (words.includes(',') && !(words.length === 4 && parts.length === 3 && words[2] === ',' && month >= 0)) return;
  if (month >= 0 && parts.length === 2 && /^[1-9]\d{3}$/u.test(parts[1])) return 0;
  const dayIndex = month >= 0 ? 1 : 0;
  const ordinal = /^(\d{1,2})(st|nd|rd|th)?$/iu.exec(parts[dayIndex]);
  if (!ordinal) return;
  const day = Number(ordinal[1]);
  const suffix = day >= 11 && day <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10] ?? 'th';
  if (ordinal[2] && ordinal[2].toLowerCase() !== suffix) return;
  const year = parts.length === 3 ? Number(parts[2]) : undefined;
  if (year !== undefined && !/^[1-9]\d{3}$/u.test(parts[2])) return;
  const leap = year === undefined || year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const limit = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month >= 0 ? month : monthAfterDay];
  if (day >= 1 && day <= limit) return dayIndex;
}

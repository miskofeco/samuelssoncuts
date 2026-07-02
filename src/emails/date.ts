export function formatEmailDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  const weekday = new Intl.DateTimeFormat("sk-SK", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);

  return `${weekday} ${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
}

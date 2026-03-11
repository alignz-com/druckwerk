export function addBusinessDays(start: Date, days: number) {
  const date = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const weekDay = date.getDay();
    if (weekDay !== 0 && weekDay !== 6) {
      remaining -= 1;
    }
  }
  return date;
}


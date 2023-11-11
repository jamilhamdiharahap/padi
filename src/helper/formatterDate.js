export function formatterDate(isoDateString) {
 const date = new Date(isoDateString);
 const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
 return formattedDate;
}

export function formatterDateTwo(isoDateString) {
 const date = new Date(isoDateString);
 const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
 return formattedDate;
}

export function formatterDayOff(isoDateString) {
 const year = isoDateString.slice(0, 4);
 const month = isoDateString.slice(5, 7);
 const day = isoDateString.slice(8, 10);

 const firstDay = new Date(year, month - 1, day);

 const dayOfWeek = firstDay.toLocaleString('id-ID', { weekday: 'long' });
 const isDayOff = (dayOfWeek === 'Sabtu' || dayOfWeek === 'Minggu');

 if (isDayOff) {
  return 'Off'
 } else {
  return 'On'
 }
}
const PLATFORM_TIME_ZONE = 'Africa/Nairobi';

/**
 * @param {Date | string} approvedAt
 */
export const getNextPlatformPayDate = (approvedAt) => {
  const timestamp = approvedAt instanceof Date ? approvedAt : new Date(approvedAt);
  if (Number.isNaN(timestamp.getTime())) {
    throw new RangeError('A valid approval timestamp is required to determine the next payment date.');
  }

  const parts = new Intl.DateTimeFormat('en', {
    timeZone: PLATFORM_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(timestamp);
  const calendarDate = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const year = Number(calendarDate.year);
  const month = Number(calendarDate.month) - 1;
  const day = Number(calendarDate.day);
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  let paymentDate;
  if (day < 15) {
    paymentDate = new Date(Date.UTC(year, month, 15));
  } else if (day < lastDayOfMonth) {
    paymentDate = new Date(Date.UTC(year, month, lastDayOfMonth));
  } else {
    paymentDate = new Date(Date.UTC(year, month + 1, 15));
  }

  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(paymentDate);
};

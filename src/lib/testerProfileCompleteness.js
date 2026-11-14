const PROFILE_FIELDS = [
  ['uTest ID', (profile, details) => hasValue(profile.uTestId, details.utest_id)],
  ['uTest email', (profile, details) => hasValidEmail(profile.uTestEmail, details.utest_email)],
  ['legal name', (profile, details) => hasValue(profile.legalName, details.full_name)],
  ['date of birth', (profile, details) => hasValidDateOfBirth(profile.dateOfBirth, details.date_of_birth)],
  ['phone number', (profile, details) => hasValidPhone(profile.phone, details.phone_number)],
  ['country', (profile, details, account) => hasValue(profile.country, details.country, account.country)]
];

const hasValue = (...values) => values.some((value) => typeof value === 'string' && value.trim().length > 0);

const hasValidEmail = (...values) => values.some((value) =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
);

const hasValidDateOfBirth = (...values) => values.some((value) => {
  if (typeof value !== 'string') return false;
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    && parsed.getTime() < new Date().setUTCHours(0, 0, 0, 0);
});

const hasValidPhone = (...values) => values.some((value) => {
  if (typeof value !== 'string') return false;
  const phone = value.trim();
  const digitCount = phone.replace(/\D/g, '').length;
  return /^\+?[0-9][0-9 ().-]*$/.test(phone) && digitCount >= 7 && digitCount <= 15;
});

export const getMissingTesterProfileFields = (account, applicationDetails = []) => {
  const testerProfile = account?.profile_data?.testerProfile
    && typeof account.profile_data.testerProfile === 'object'
    ? account.profile_data.testerProfile
    : {};
  const detailsRows = Array.isArray(applicationDetails) ? applicationDetails : [applicationDetails];
  const validDetails = detailsRows.filter((details) => details && typeof details === 'object');

  return PROFILE_FIELDS
    .filter(([, isComplete]) => !validDetails.some((details) => isComplete(testerProfile, details, account || {})))
    .map(([label]) => label);
};

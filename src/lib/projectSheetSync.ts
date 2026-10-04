export type ProjectEligibilitySheetRow = {
  source_key: string;
  source_timestamp: string;
  consent: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  email: string;
  terms_agreed: string;
  utest_id: string;
  matched_profile_id: null;
  match_status: 'unmatched';
  synced_at: string;
};

export type ProjectApplauseSheetRow = {
  source_key: string;
  status: string;
  tester_id: string;
  tester_email: string;
  google_email: string;
  consent_name: string;
  id_scan_status: string;
  utest_id: string;
  issues: string;
};

const parseCsv = (csv: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
};

const normalizeHeader = (header: string) =>
  header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');

const hashSourceKey = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const parseProjectEligibilitySheet = async (
  csv: string,
  projectId: string
): Promise<ProjectEligibilitySheetRow[]> => {
  const [rawHeaders, ...records] = parseCsv(csv);
  if (!rawHeaders) throw new Error('The eligibility sheet is empty or has no header row.');

  const headers = rawHeaders.map(normalizeHeader);
  const findColumn = (predicate: (header: string) => boolean) => headers.findIndex(predicate);
  const columns = {
    timestamp: findColumn((header) => header.includes('timestamp')),
    consent: findColumn((header) => header.includes('consent to the information')),
    fullName: findColumn((header) => header.includes('your name') || header === 'name' || header.includes('full name')),
    dateOfBirth: findColumn((header) => header.includes('date of birth') || header.includes('(dob)')),
    gender: findColumn((header) => header.includes('gender')),
    email: findColumn((header) => header.includes('email address') || header === 'email' || header.includes('email')),
    termsAgreed: findColumn((header) => header.includes('agree to the above terms')),
    utestId: findColumn((header) => header.includes('what is your utest id') || header === 'utest id' || header.includes('utest id'))
  };

  if (columns.fullName < 0 || columns.email < 0) {
    throw new Error('The eligibility sheet needs a name column and an email column.');
  }

  const read = (cells: string[], column: number) => column < 0 ? '' : (cells[column] || '').trim();
  const uniqueRows = new Map<string, ProjectEligibilitySheetRow>();
  for (const cells of records) {
    const participant = {
      source_timestamp: read(cells, columns.timestamp),
      consent: read(cells, columns.consent),
      full_name: read(cells, columns.fullName),
      date_of_birth: read(cells, columns.dateOfBirth),
      gender: read(cells, columns.gender),
      email: read(cells, columns.email).toLowerCase(),
      terms_agreed: read(cells, columns.termsAgreed),
      utest_id: read(cells, columns.utestId)
    };
    if (!participant.full_name && !participant.email && !participant.utest_id) continue;

    const fallbackIdentity = JSON.stringify(participant);
    const sourceIdentity = `${projectId}|${participant.source_timestamp
      ? `timestamp:${participant.source_timestamp}|email:${participant.email}`
      : `row:${fallbackIdentity}`}`;
    const sourceKey = await hashSourceKey(sourceIdentity);
    uniqueRows.set(sourceKey, {
      source_key: sourceKey,
      ...participant,
      matched_profile_id: null,
      match_status: 'unmatched',
      synced_at: new Date().toISOString()
    });
  }

  if (uniqueRows.size === 0) {
    throw new Error('No participant responses were found in the eligibility sheet; the saved database snapshot was left unchanged.');
  }
  return [...uniqueRows.values()];
};

export const parseProjectApplauseSheet = async (csv: string): Promise<ProjectApplauseSheetRow[]> => {
  const [rawHeaders, ...dataRows] = parseCsv(csv);
  if (!rawHeaders) throw new Error('The Applause status sheet is empty or has no header row.');

  const headers = rawHeaders.map(normalizeHeader);
  const statusColumn = headers.indexOf('status');
  if (statusColumn < 0) throw new Error('The Applause sheet is missing its Status column.');

  const columns = {
    status: statusColumn,
    testerId: headers.indexOf('tester id'),
    testerEmail: headers.indexOf('tester email'),
    googleEmail: headers.indexOf('google email'),
    consentName: headers.indexOf('consent name'),
    idScanStatus: headers.indexOf('id scan status'),
    utestId: headers.indexOf('utest id'),
    issues: headers.indexOf('issues')
  };
  const read = (cells: string[], column: number) => column < 0 ? '' : (cells[column] || '').trim();
  const uniqueRows = new Map<string, ProjectApplauseSheetRow>();

  for (const cells of dataRows) {
    const parsed = {
      status: read(cells, columns.status),
      tester_id: read(cells, columns.testerId),
      tester_email: read(cells, columns.testerEmail),
      google_email: read(cells, columns.googleEmail),
      consent_name: read(cells, columns.consentName),
      id_scan_status: read(cells, columns.idScanStatus),
      utest_id: read(cells, columns.utestId),
      issues: read(cells, columns.issues)
    };
    if (!Object.values(parsed).some(Boolean)) continue;

    const identity = parsed.tester_id || parsed.tester_email.toLowerCase() || parsed.google_email.toLowerCase();
    const sourceKey = await hashSourceKey(identity || JSON.stringify(parsed));
    uniqueRows.set(sourceKey, { source_key: sourceKey, ...parsed });
  }

  if (uniqueRows.size === 0) {
    throw new Error('The Applause status sheet has no participant rows; the saved database snapshot was left unchanged.');
  }
  return [...uniqueRows.values()];
};

export const fetchSheetCsv = async (url: string, signal?: AbortSignal) => {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}_=${Date.now()}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}.`);
  return response.text();
};

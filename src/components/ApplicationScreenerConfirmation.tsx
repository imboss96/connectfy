import React, { useState } from 'react';
import { APPLICATION_SCREENER_FORM_URL } from '../lib/applicationScreener';

export const ApplicationScreenerConfirmation: React.FC<{
  confirmed: boolean;
  hasValidAccount: boolean;
  onConfirmationChange: (confirmed: boolean) => void;
}> = ({ confirmed, hasValidAccount, onConfirmationChange }) => {
  const [opened, setOpened] = useState(false);

  return (
    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
      <a
        href={APPLICATION_SCREENER_FORM_URL}
        target="_blank"
        rel="noreferrer"
        onClick={() => setOpened(true)}
        className="text-xs font-bold text-sky-800 underline underline-offset-2"
      >
        Open required applicant screener form
      </a>
      <p className="mt-1 text-[11px] text-sky-900">Review the applicant’s uTest ID and screenshot, submit the screener, then confirm below. Approval is blocked until all checks are complete.</p>
      <label className="mt-2 flex items-start gap-2 text-[11px] font-medium text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={confirmed}
          disabled={!opened}
          onChange={(event) => onConfirmationChange(event.target.checked)}
        />
        <span>I submitted the screener for this applicant and verified the uTest ID and screenshot.</span>
      </label>
      {!hasValidAccount && (
        <p className="mt-2 text-[11px] font-semibold text-rose-700">Approval also requires a saved uTest ID and a valid screenshot URL.</p>
      )}
    </div>
  );
};

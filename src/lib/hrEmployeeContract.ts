export interface EmployeeContractTermsSnapshot {
  job_title: string;
  compensation_type: string;
  compensation_rate: number;
  compensation_currency: string;
  pay_frequency: string;
}

export function buildEmployeeContractTermsSnapshot(
  values: EmployeeContractTermsSnapshot
): EmployeeContractTermsSnapshot {
  return {
    job_title: values.job_title.trim(),
    compensation_type: values.compensation_type,
    compensation_rate: Number(values.compensation_rate),
    compensation_currency: values.compensation_currency.trim(),
    pay_frequency: values.pay_frequency
  };
}

export function employeeContractTermsChanged(
  savedTerms: EmployeeContractTermsSnapshot | null | undefined,
  currentTerms: EmployeeContractTermsSnapshot
): boolean {
  if (!savedTerms) return true;
  const saved = buildEmployeeContractTermsSnapshot(savedTerms);
  const current = buildEmployeeContractTermsSnapshot(currentTerms);
  return saved.job_title !== current.job_title
    || saved.compensation_type !== current.compensation_type
    || saved.compensation_rate !== current.compensation_rate
    || saved.compensation_currency !== current.compensation_currency
    || saved.pay_frequency !== current.pay_frequency;
}

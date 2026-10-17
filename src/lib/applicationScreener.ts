export const APPLICATION_SCREENER_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeEPV0KzYwNLeLGlhvtvotOSt7goCnw4GB8bonAqJEQjqCLzA/viewform';

export interface ApplicationScreenerResult {
  submitted: boolean;
  queued: boolean;
  retryable: boolean;
  message: string;
}

export const hasValidUtestIdAndScreenshot = (utestId?: string, screenshotUrl?: string) => {
  if (!utestId?.trim() || !screenshotUrl) return false;
  try {
    const url = new URL(screenshotUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

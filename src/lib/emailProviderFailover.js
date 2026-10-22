export class EmailProviderHttpError extends Error {
  constructor(provider, status, responseBody) {
    super(`${provider} rejected the email request with HTTP ${status}.`);
    this.name = 'EmailProviderHttpError';
    this.provider = provider;
    this.status = status;
    this.responseBody = responseBody;
  }
}

export const isQuotaRejection = (error) => error instanceof EmailProviderHttpError
  && (
    error.status === 429
    || /quota|daily.{0,24}limit|rate.{0,24}limit|too many requests|sending.{0,24}limit/i.test(error.responseBody)
  );

export async function sendWithEmailProviderFailover({
  preferredProvider,
  availableProviders,
  send,
  onFailover = () => {}
}) {
  const preferred = preferredProvider === 'mailjet' ? 'mailjet' : 'brevo';
  const primaryProvider = availableProviders[preferred]
    ? preferred
    : preferred === 'brevo' ? 'mailjet' : 'brevo';
  const fallbackProvider = primaryProvider === 'brevo' ? 'mailjet' : 'brevo';
  if (!availableProviders[primaryProvider]) {
    throw new Error('Configure BREVO_API_KEY or both MAILJET_API_KEY and MAILJET_API_SECRET to send email.');
  }

  try {
    return await send(primaryProvider);
  } catch (error) {
    if (!availableProviders[fallbackProvider] || !isQuotaRejection(error)) throw error;
    onFailover(primaryProvider, fallbackProvider);
    try {
      return await send(fallbackProvider);
    } catch (fallbackError) {
      if (fallbackError instanceof EmailProviderHttpError) {
        throw new Error(`${primaryProvider} reached its sending limit and ${fallbackProvider} rejected the email with HTTP ${fallbackError.status}.`);
      }
      throw new Error(`${primaryProvider} reached its sending limit, and the ${fallbackProvider} send could not be confirmed.`);
    }
  }
}

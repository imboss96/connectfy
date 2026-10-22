export class EmailProviderHttpError extends Error {
  constructor(provider, status, responseBody) {
    super(`${provider} rejected the email request with status ${status}.`);
    this.name = 'EmailProviderHttpError';
    this.provider = provider;
    this.status = status;
    this.responseBody = responseBody;
  }
}

export const isQuotaRejection = (error) => error instanceof EmailProviderHttpError
  && (
    error.status === 429
    || error.provider === 'sender' && error.status >= 400 && error.status < 500
    || /quota|daily.{0,24}limit|rate.{0,24}limit|too many requests|sending.{0,24}limit/i.test(error.responseBody)
  );

export async function sendWithEmailProviderFailover({
  preferredProvider,
  availableProviders,
  send,
  onFailover = () => {}
}) {
  const providerOrder = ['brevo', 'mailjet', 'sender'];
  const preferred = providerOrder.includes(preferredProvider) ? preferredProvider : 'brevo';
  const availableOrder = [
    preferred,
    ...providerOrder.filter((provider) => provider !== preferred)
  ].filter((provider) => availableProviders[provider]);

  if (!availableOrder.length) {
    throw new Error('Configure BREVO_API_KEY, both MAILJET_API_KEY and MAILJET_API_SECRET, or Sender SMTP credentials to send email.');
  }

  let quotaLimitedProvider = null;
  for (let index = 0; index < availableOrder.length; index += 1) {
    const provider = availableOrder[index];
    try {
      return await send(provider);
    } catch (error) {
      if (!isQuotaRejection(error) || index === availableOrder.length - 1) {
        if (!quotaLimitedProvider) throw error;
        if (error instanceof EmailProviderHttpError) {
          throw new Error(`${quotaLimitedProvider} reached its sending limit and ${provider} rejected the email with status ${error.status}.`);
        }
        throw new Error(`${quotaLimitedProvider} reached its sending limit, and the ${provider} send could not be confirmed.`);
      }
      quotaLimitedProvider = provider;
      onFailover(provider, availableOrder[index + 1]);
    }
  }

  throw new Error('No email provider accepted the message.');
}

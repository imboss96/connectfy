export const CONNECTFY_WHATSAPP_NUMBER = '254703147873';
export const CONNECTFY_SUPPORT_PHONE = '+254703147873';

export const buildProfileHelpWhatsAppUrl = (email) => {
  const accountEmail = String(email || '').trim() || 'not available';
  const message = `Hi Connectfy team, I need help completing my profile. My account email is ${accountEmail}.`;
  return `https://wa.me/${CONNECTFY_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
};

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
  bytes: number;
  format?: string;
}

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(cloudName && uploadPreset);

export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary is not configured. Add the VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET variables.');
  }

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Cloudinary upload failed (${response.status}): ${detail}`);
  }

  return response.json() as Promise<CloudinaryUploadResult>;
}

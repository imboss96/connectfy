const supportedDeliverableFormats = [
  'No file required',
  'WAV audio (44.1 kHz, 16-bit)',
  'WAV audio (44.1 kHz, 16-bit mono)',
  'WAV audio (48 kHz, 24-bit)',
  'MP3 audio',
  'M4A audio',
  'FLAC audio',
  'OGG audio',
  'MP4 video',
  'MOV video',
  'WebM video',
  'JPG / JPEG image',
  'PNG image',
  'HEIC image',
  'WebP image',
  'CSV spreadsheet',
  'XLSX spreadsheet',
  'JSON data',
  'XML data',
  'TXT text',
  'Markdown',
  'PDF document',
  'ZIP archive',
  'Receipt photo with geo-tagged timestamp',
  'Structured JSON / Markdown rubric',
  'Other (see instructions)'
] as const;

export function getDeliverableFormatOptions(currentFormat?: string): string[] {
  const formats = [...supportedDeliverableFormats];
  if (currentFormat && !formats.includes(currentFormat as typeof supportedDeliverableFormats[number])) {
    formats.unshift(currentFormat);
  }
  return formats;
}

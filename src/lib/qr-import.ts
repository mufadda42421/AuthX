/**
 * QR Code scanning and otpauth:// URI parsing module
 * Uses jsqr for pure client-side image processing.
 */

import jsQR from 'jsqr';
import { ParsedOTPAuth, parseOtpAuthUri } from './totp';

/**
 * Scans an HTML Image or Canvas element and extracts the decoded QR code string
 */
export function scanImageData(imageData: ImageData): string | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  return code ? code.data : null;
}

/**
 * Scans a File (e.g. from file input or drag-and-drop) and parses the OTPAuth URI
 */
export async function scanQRCodeFile(file: File): Promise<ParsedOTPAuth> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Could not create canvas 2D rendering context.'));
          }

          ctx.drawImage(img, 0, 0, img.width, img.height);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const qrText = scanImageData(imageData);

          if (!qrText) {
            return reject(
              new Error(
                'No QR code detected in this image. Please ensure the QR code is clear and well-lit.'
              )
            );
          }

          const parsed = parseOtpAuthUri(qrText);
          resolve(parsed);
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          reject(new Error(`Failed to parse QR code: ${errorMsg}`));
        }
      };

      img.onerror = () => reject(new Error('Failed to load image file for QR scanning.'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Scans an image blob pasted from clipboard
 */
export async function scanClipboardItem(item: DataTransferItem): Promise<ParsedOTPAuth | null> {
  if (item.type.indexOf('image') === -1) return null;
  const file = item.getAsFile();
  if (!file) return null;
  return scanQRCodeFile(file);
}

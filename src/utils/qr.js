import QRCode from 'qrcode';
import jsQR   from 'jsqr';

/**
 * Generate a QR code PNG as a base64 data URL
 * @param {string} batchId
 * @returns {Promise<string>} data URL
 */
export async function generateQR(batchId) {
  return QRCode.toDataURL(batchId, {
    width:            256,
    margin:           2,
    color: {
      dark:  '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
}

/**
 * Decode a QR code from a raw ImageData object (from canvas / video frame)
 * @param {ImageData} imageData
 * @returns {string|null} decoded string or null
 */
export function scanQRFromImageData(imageData) {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  });
  return code ? code.data : null;
}

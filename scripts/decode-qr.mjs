import jsQR from 'jsqr';
import { spawnSync } from 'node:child_process';

const py = spawnSync('python', [
  '-c',
  'from PIL import Image; import sys; im = Image.open("public/branding/back_qr_crop.png").convert("RGBA"); sys.stdout.buffer.write(bytes([im.width >> 8, im.width & 0xFF, im.height >> 8, im.height & 0xFF]) + im.tobytes())'
]);

const buf = py.stdout;
const w = (buf[0] << 8) | buf[1];
const h = (buf[2] << 8) | buf[3];
const rgba = new Uint8ClampedArray(buf.subarray(4));
const code = jsQR(rgba, w, h);
if (code) {
  console.log('DECODED BACK QR PAYLOAD:', code.data);
} else {
  console.log('jsQR could not decode');
}


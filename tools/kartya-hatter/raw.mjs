import { spawnSync } from 'node:child_process';
// az ffmpeg: FFMPEG kornyezeti valtozo, vagy a PATH-on levo ffmpeg
const FF = process.env.FFMPEG || 'ffmpeg';
export function olvas(fajl, w, h) {
  const r = spawnSync(FF, ['-v', 'error', '-i', fajl, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  return new Uint8Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length);
}
export function ir(buf, w, h, fajl) {
  const r = spawnSync(FF, ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-', ...(fajl.endsWith('.jpg') ? ['-q:v', process.env.JPGQ || '2'] : []), fajl], { input: Buffer.from(buf.buffer, buf.byteOffset, buf.length), maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(String(r.stderr));
}

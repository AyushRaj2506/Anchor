import { createHash } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import { MAX_FILE_BYTES } from './validation.js';
import { getStorageClient } from './clients.js';

export function validateFileBytes(bytes, mime) {
  const fail = () => { throw Object.assign(new Error('The file content does not match a supported, safe document or image.'), { status: 422 }); };
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) fail();
  if (mime === 'application/pdf') {
    if (bytes.subarray(0, 5).toString() !== '%PDF-' || !bytes.subarray(-2048).includes(Buffer.from('%%EOF'))) fail();
    // These checks reject common active/encrypted PDF constructs. They are not a
    // substitute for an antivirus engine or full sandboxed document rendering.
    if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|Encrypt)\b/.test(bytes.toString('latin1'))) fail();
  } else if (mime === 'image/png') {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      || bytes.subarray(12, 16).toString() !== 'IHDR' || !bytes.subarray(-12).includes(Buffer.from('IEND'))
      || !bytes.readUInt32BE(16) || !bytes.readUInt32BE(20) || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 40000000) fail();
  } else if (mime === 'image/jpeg') {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) fail();
  } else if (mime === 'image/webp') {
    if (bytes.length < 20 || bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP'
      || bytes.readUInt32LE(4) + 8 !== bytes.length) fail();
  } else fail();
  return createHash('sha256').update(bytes).digest('hex');
}

export async function scanFile(bytes) {
  if (!process.env.CLAMAV_HOST) return { antivirus: 'not_configured' };
  await new Promise((resolve, reject) => {
    const port = Number(process.env.CLAMAV_PORT || 3310);
    const connect = process.env.CLAMAV_TLS === 'true' ? tls.connect : net.connect;
    const socket = connect({ host: process.env.CLAMAV_HOST, port });
    let result = '';
    socket.setTimeout(8000, () => socket.destroy(new Error('Scanner timed out.')));
    socket.on('error', () => reject(Object.assign(new Error('File inspection is temporarily unavailable.'), { status: 503 })));
    socket.on('data', chunk => { result += chunk.toString(); if (result.length > 4096) socket.destroy(); });
    socket.on('close', () => reject(Object.assign(new Error('File inspection could not be completed.'), { status: 503 })));
    socket.on('end', () => {
      if (result.replaceAll('\0', '').trim() === 'stream: OK') resolve();
      else reject(Object.assign(new Error(/FOUND/.test(result) ? 'The file was rejected by security inspection.' : 'File inspection could not be completed.'), { status: /FOUND/.test(result) ? 422 : 503 }));
    });
    socket.on(process.env.CLAMAV_TLS === 'true' ? 'secureConnect' : 'connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        const chunk = bytes.subarray(offset, offset + 65536), length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length); socket.write(length); socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
  return { antivirus: 'passed' };
}

export async function inspectBlob(blob, mime, storagePath = null) {
  if (blob.size > MAX_FILE_BYTES) throw Object.assign(new Error('File exceeds the 20 MB limit.'), { status: 413 });
  let sha256 = null;
  try {
    if (storagePath) {
      const { data: intent, error } = await getStorageClient().rpc('anchor_upload_intent', { object_path: storagePath });
      if (error) throw error;
      if (intent && (intent.mime !== mime || intent.size !== blob.size || ['deleting', 'deleted', 'rejected'].includes(intent.state))) {
        throw Object.assign(new Error('The file does not match its upload registration. Please upload it again.'), { status: 422 });
      }
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    sha256 = validateFileBytes(bytes, mime);
    const scan = await scanFile(bytes);
    if (storagePath) {
      const saved = await getStorageClient().rpc('anchor_record_inspection', { object_path: storagePath, digest: sha256, rejected: false });
      if (saved.error) throw saved.error;
    }
    return { bytes, sha256, ...scan };
  } catch (error) {
    if (storagePath && error.status === 422) {
      await getStorageClient().rpc('anchor_record_inspection', { object_path: storagePath, digest: sha256, rejected: true });
    }
    throw error;
  }
}

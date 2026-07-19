// Application-layer encryption for personal information at rest (POPIA
// defense-in-depth on top of Supabase's disk-level encryption). Customer name
// and phone are encrypted before insert and decrypted on read, so raw table
// access (dumps, console viewers, a leaked service key) never sees plaintext.
//
// Format: "enc:v1:" + base64(iv[12] | ciphertext | gcmTag[16]), AES-256-GCM.
// The prefix makes encrypted values self-identifying, so legacy plaintext rows
// written before this existed still read back correctly.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer | null {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    console.warn('[crypto] PII_ENCRYPTION_KEY not set — personal data will be stored in plaintext');
    return null;
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    console.error('[crypto] PII_ENCRYPTION_KEY must decode to 32 bytes (generate: openssl rand -base64 32)');
    return null;
  }
  return key;
}

const key = loadKey();

export function encryptPII(plain: string): string {
  if (!key || !plain) return plain;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString('base64');
}

export function decryptPII(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value; // legacy plaintext row
  if (!key) return '[encrypted]'; // key missing on this deploy — don't crash
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(buf.length - TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('[crypto] decrypt failed (wrong key?):', err);
    return '[unreadable]';
  }
}

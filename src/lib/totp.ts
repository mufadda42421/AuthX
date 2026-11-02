/**
 * RFC 6238 TOTP (Time-Based One-Time Password) & RFC 4226 HOTP Implementation
 * Uses standard Web Crypto API (crypto.subtle) - Zero external dependencies.
 */

export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface TOTPOptions {
  timestamp?: number; // Milliseconds since UNIX epoch (defaults to Date.now())
  period?: number;    // Time step in seconds (default: 30)
  digits?: number;    // Number of digits (default: 6, supports 6 or 8)
  algorithm?: HashAlgorithm; // Hash algorithm (default: SHA-1)
}

export interface ParsedOTPAuth {
  type: 'totp' | 'hotp';
  label: string;
  account: string;
  issuer: string;
  secret: string;
  algorithm: HashAlgorithm;
  digits: number;
  period: number;
  counter?: number;
}

// RFC 4648 Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Validates whether a string is valid Base32 (ignoring spaces and padding)
 */
export function validateBase32(secret: string): boolean {
  if (!secret) return false;
  const clean = secret.toUpperCase().replace(/[\s\-=]/g, '');
  if (clean.length === 0) return false;
  for (let i = 0; i < clean.length; i++) {
    if (BASE32_ALPHABET.indexOf(clean[i]) === -1) {
      return false;
    }
  }
  return true;
}

/**
 * Decodes a Base32 string to Uint8Array (RFC 4648)
 */
export function base32ToUint8Array(secret: string): Uint8Array {
  const clean = secret.toUpperCase().replace(/[\s\-=]/g, '');
  if (!clean) {
    throw new Error('Base32 secret cannot be empty');
  }

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) {
      throw new Error(`Invalid Base32 character: ${clean[i]}`);
    }
    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Encodes Uint8Array to Base32 string (for key generation or export)
 */
export function uint8ArrayToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Generates an 8-byte big-endian counter buffer for the time step
 */
function counterToUint8Array(counter: number | bigint): Uint8Array {
  const buffer = new Uint8Array(8);
  const bigCounter = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    buffer[i] = Number((bigCounter >> BigInt((7 - i) * 8)) & 0xffn);
  }
  return buffer;
}

/**
 * Calculates RFC 4226 HMAC and dynamic truncation
 */
async function computeHMAC(
  keyBytes: Uint8Array,
  messageBytes: Uint8Array,
  algorithm: HashAlgorithm
): Promise<Uint8Array> {
  const subtleAlgo = {
    name: 'HMAC',
    hash: { name: algorithm },
  };

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    subtleAlgo,
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageBytes as unknown as BufferSource
  );
  return new Uint8Array(signature);
}

/**
 * Computes the OTP code given key bytes and counter value
 */
export async function computeHOTP(
  keyBytes: Uint8Array,
  counter: number | bigint,
  digits: number = 6,
  algorithm: HashAlgorithm = 'SHA-1'
): Promise<string> {
  const counterBytes = counterToUint8Array(counter);
  const hmac = await computeHMAC(keyBytes, counterBytes, algorithm);

  // Dynamic Truncation (RFC 4226 Section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  const otp = binary % mod;
  return otp.toString().padStart(digits, '0');
}

/**
 * Generates an RFC 6238 TOTP code from a Base32 secret
 */
export async function generateTOTP(
  secretBase32: string,
  options: TOTPOptions = {}
): Promise<string> {
  const {
    timestamp = Date.now(),
    period = 30,
    digits = 6,
    algorithm = 'SHA-1',
  } = options;

  const keyBytes = base32ToUint8Array(secretBase32);
  const epochSeconds = Math.floor(timestamp / 1000);
  const counter = Math.floor(epochSeconds / period);

  return computeHOTP(keyBytes, counter, digits, algorithm);
}

/**
 * Calculates remaining seconds in current TOTP cycle
 */
export function getRemainingSeconds(period: number = 30, timestamp: number = Date.now()): number {
  const epochSeconds = Math.floor(timestamp / 1000);
  return period - (epochSeconds % period);
}

/**
 * Calculates the progress ratio in current TOTP cycle (0 to 1)
 */
export function getProgressRatio(period: number = 30, timestamp: number = Date.now()): number {
  const epochSeconds = Math.floor(timestamp / 1000);
  const elapsed = epochSeconds % period;
  return elapsed / period;
}

/**
 * Formats a code with space in the middle for legibility (e.g. 123 456 or 1234 5678)
 */
export function formatOTPCode(code: string): string {
  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }
  return code;
}

/**
 * Parses standard otpauth:// URI (RFC 6238 / KeyUriFormat)
 * e.g., otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30
 */
export function parseOtpAuthUri(uri: string): ParsedOTPAuth {
  if (!uri || !uri.startsWith('otpauth://')) {
    throw new Error('Invalid URI: Must start with otpauth://');
  }

  const url = new URL(uri);
  const type = url.host.toLowerCase();
  if (type !== 'totp' && type !== 'hotp') {
    throw new Error(`Unsupported OTP type: ${type}. Only TOTP and HOTP are supported.`);
  }

  // Label: /Issuer:account or /account
  let rawLabel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  let issuer = url.searchParams.get('issuer') || '';
  let account = rawLabel;

  if (rawLabel.includes(':')) {
    const parts = rawLabel.split(':');
    const labelIssuer = parts[0].trim();
    account = parts.slice(1).join(':').trim();
    if (!issuer) {
      issuer = labelIssuer;
    }
  }

  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('URI is missing required secret parameter');
  }

  if (!validateBase32(secret)) {
    throw new Error('The secret in the URI is not a valid Base32 string');
  }

  // Algorithm
  const rawAlgo = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
  let algorithm: HashAlgorithm = 'SHA-1';
  if (rawAlgo === 'SHA256' || rawAlgo === 'SHA-256') {
    algorithm = 'SHA-256';
  } else if (rawAlgo === 'SHA512' || rawAlgo === 'SHA-512') {
    algorithm = 'SHA-512';
  } else if (rawAlgo === 'SHA1' || rawAlgo === 'SHA-1') {
    algorithm = 'SHA-1';
  } else {
    throw new Error(`Unsupported algorithm: ${rawAlgo}`);
  }

  // Digits
  const rawDigits = parseInt(url.searchParams.get('digits') || '6', 10);
  const digits = rawDigits === 8 ? 8 : 6;

  // Period
  const rawPeriod = parseInt(url.searchParams.get('period') || '30', 10);
  const period = isNaN(rawPeriod) || rawPeriod <= 0 ? 30 : rawPeriod;

  return {
    type: type as 'totp' | 'hotp',
    label: rawLabel,
    account: account || 'Account',
    issuer: issuer || 'Service',
    secret,
    algorithm,
    digits,
    period,
  };
}

/**
 * Official RFC 6238 Appendix B Test Vectors
 * Used to mathematically verify the implementation's compliance.
 */
export interface RFC6238TestVector {
  timeSeconds: number;
  timeUTC: string;
  sha1Expected: string;
  sha256Expected: string;
  sha512Expected: string;
}

export const RFC_6238_TEST_VECTORS: RFC6238TestVector[] = [
  {
    timeSeconds: 59,
    timeUTC: '1970-01-01 00:00:59',
    sha1Expected: '94287082',
    sha256Expected: '46119246',
    sha512Expected: '90693936',
  },
  {
    timeSeconds: 1111111109,
    timeUTC: '2005-03-18 01:58:29',
    sha1Expected: '07081804',
    sha256Expected: '68084774',
    sha512Expected: '25091201',
  },
  {
    timeSeconds: 1111111111,
    timeUTC: '2005-03-18 01:58:31',
    sha1Expected: '14050471',
    sha256Expected: '67062674',
    sha512Expected: '99943326',
  },
  {
    timeSeconds: 1234567890,
    timeUTC: '2009-02-13 23:31:30',
    sha1Expected: '89005924',
    sha256Expected: '91819424',
    sha512Expected: '93441996',
  },
  {
    timeSeconds: 2000000000,
    timeUTC: '2033-05-18 03:33:20',
    sha1Expected: '69279037',
    sha256Expected: '90698825',
    sha512Expected: '38618901',
  },
  {
    timeSeconds: 20000000000,
    timeUTC: '2603-10-11 11:33:20',
    sha1Expected: '65353130',
    sha256Expected: '77737706',
    sha512Expected: '47863826',
  },
];

// RFC 6238 Seed keys from Appendix B (ASCII "12345678901234567890"...)
const RFC_KEY_ASCII_20 = '12345678901234567890';
const RFC_KEY_ASCII_32 = '12345678901234567890123456789012';
const RFC_KEY_ASCII_64 = '1234567890123456789012345678901234567890123456789012345678901234';

function asciiToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Runs the official RFC 6238 Appendix B test suite against this implementation.
 */
export async function runRFC6238TestSuite(): Promise<{
  allPassed: boolean;
  results: {
    timeSeconds: number;
    algorithm: HashAlgorithm;
    calculated: string;
    expected: string;
    passed: boolean;
  }[];
}> {
  const results: {
    timeSeconds: number;
    algorithm: HashAlgorithm;
    calculated: string;
    expected: string;
    passed: boolean;
  }[] = [];

  const key20 = asciiToUint8Array(RFC_KEY_ASCII_20);
  const key32 = asciiToUint8Array(RFC_KEY_ASCII_32);
  const key64 = asciiToUint8Array(RFC_KEY_ASCII_64);

  for (const v of RFC_6238_TEST_VECTORS) {
    const counter = Math.floor(v.timeSeconds / 30);

    // SHA-1 (8 digits)
    const sha1Calc = await computeHOTP(key20, counter, 8, 'SHA-1');
    results.push({
      timeSeconds: v.timeSeconds,
      algorithm: 'SHA-1',
      calculated: sha1Calc,
      expected: v.sha1Expected,
      passed: sha1Calc === v.sha1Expected,
    });

    // SHA-256 (8 digits)
    const sha256Calc = await computeHOTP(key32, counter, 8, 'SHA-256');
    results.push({
      timeSeconds: v.timeSeconds,
      algorithm: 'SHA-256',
      calculated: sha256Calc,
      expected: v.sha256Expected,
      passed: sha256Calc === v.sha256Expected,
    });

    // SHA-512 (8 digits)
    const sha512Calc = await computeHOTP(key64, counter, 8, 'SHA-512');
    results.push({
      timeSeconds: v.timeSeconds,
      algorithm: 'SHA-512',
      calculated: sha512Calc,
      expected: v.sha512Expected,
      passed: sha512Calc === v.sha512Expected,
    });
  }

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}

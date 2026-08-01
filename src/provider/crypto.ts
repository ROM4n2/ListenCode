import forge from 'node-forge';
import * as crypto from 'crypto';

function aesEncrypt(text: string, key: string, mode: 'CBC' | 'ECB', iv?: string): string {
  const cipher = forge.cipher.createCipher(
    mode === 'CBC' ? 'AES-CBC' : 'AES-ECB',
    key
  );
  if (mode === 'CBC' && iv) {
    cipher.start({ iv });
  } else {
    cipher.start();
  }
  cipher.update(forge.util.createBuffer(text));
  cipher.finish();
  return forge.util.encode64(cipher.output.data);
}

function aesEncryptHex(text: string, key: string, mode: 'CBC' | 'ECB', iv?: string): string {
  const cipher = forge.cipher.createCipher(
    mode === 'CBC' ? 'AES-CBC' : 'AES-ECB',
    key
  );
  if (mode === 'CBC' && iv) {
    cipher.start({ iv });
  } else {
    cipher.start();
  }
  cipher.update(forge.util.createBuffer(text));
  cipher.finish();
  return cipher.output.toHex();
}

function rsaEncrypt(text: string, pubKey: string, modulus: string): string {
  const reversed = text.split('').reverse().join('');
  const n = new forge.jsbn.BigInteger(modulus, 16);
  const e = new forge.jsbn.BigInteger(pubKey, 16);
  const b = new forge.jsbn.BigInteger(forge.util.bytesToHex(reversed), 16);
  const enc = b.modPow(e, n).toString(16).padStart(256, '0');
  return enc;
}

function createSecretKey(size: number): string {
  const choice = '012345679abcdef';
  const bytes = crypto.randomBytes(size);
  let result = '';
  for (let i = 0; i < size; i += 1) {
    result += choice[bytes[i] % choice.length];
  }
  return result;
}

const NE_MODULUS =
  '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b72' +
  '5152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbd' +
  'a92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe48' +
  '75d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';

const NE_NONCE = '0CoJUm6Qyw8W8jud';
const NE_PUBKEY = '010001';
const EAPI_KEY = 'e82ckenh8dichen8';

export function weapi(object: Record<string, unknown>): { params: string; encSecKey: string } {
  const text = JSON.stringify(object);
  const secKey = createSecretKey(16);
  const encText = aesEncrypt(
    aesEncrypt(text, NE_NONCE, 'CBC', '0102030405060708'),
    secKey,
    'CBC',
    '0102030405060708'
  );
  const encSecKey = rsaEncrypt(secKey, NE_PUBKEY, NE_MODULUS);
  return { params: encText, encSecKey };
}

export function eapi(url: string, object: Record<string, unknown>): string {
  const text = JSON.stringify(object);
  const message = `nobody${url}use${text}md5forencrypt`;
  const digest = forge.md5.create().update(forge.util.encodeUtf8(message)).digest().toHex();
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  return aesEncryptHex(data, EAPI_KEY, 'ECB').toUpperCase();
}

export function md5(text: string): string {
  return forge.md5.create().update(text).digest().toHex();
}

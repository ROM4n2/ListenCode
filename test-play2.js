const axios = require('axios');
const crypto = require('crypto');
const forge = require('node-forge');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 测试1: 网易云公开搜索接口（不走 weapi）
async function testPublic() {
  console.log('\n=== 测试1: 网易云公开搜索 ===');
  try {
    const url = 'https://music.163.com/api/search/pc';
    const res = await axios.post(url, new URLSearchParams({
      s: '周杰伦', offset: 0, limit: 3, type: 1,
    }), {
      headers: { 'User-Agent': UA, 'Referer': 'https://music.163.com/', 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log('status:', res.status);
    console.log('data keys:', Object.keys(res.data || {}));
    console.log('result:', JSON.stringify(res.data).slice(0, 300));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

// 测试2: 网易云 weapi（正确加密）
async function testWeapi() {
  console.log('\n=== 测试2: 网易云 weapi 搜索 ===');
  try {
    const modulus = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
    const nonce = '0CoJUm6Qyw8W8jud';
    const pubKey = '010001';
    const text = JSON.stringify({ s: '周杰伦', offset: 0, limit: 3, type: 1 });
    const secKey = Array.from({ length: 16 }, () => '012345679abcdef'[Math.floor(Math.random() * 16)]).join('');

    const c1 = forge.cipher.createCipher('AES-CBC', nonce);
    c1.start({ iv: '0102030405060708' });
    c1.update(forge.util.createBuffer(text));
    c1.finish();
    const first = forge.util.encode64(c1.output.data);

    const c2 = forge.cipher.createCipher('AES-CBC', secKey);
    c2.start({ iv: '0102030405060708' });
    c2.update(forge.util.createBuffer(first));
    c2.finish();
    const encText = forge.util.encode64(c2.output.data);

    const reversed = secKey.split('').reverse().join('');
    const n = new forge.jsbn.BigInteger(modulus, 16);
    const e = new forge.jsbn.BigInteger(pubKey, 16);
    const b = new forge.jsbn.BigInteger(forge.util.bytesToHex(reversed), 16);
    const encSecKey = b.modPow(e, n).toString(16).padStart(256, '0');

    console.log('encText length:', encText.length);
    console.log('encSecKey length:', encSecKey.length);

    const url = 'https://music.163.com/weapi/search/get';
    const res = await axios.post(url, new URLSearchParams({ params: encText, encSecKey }).toString(), {
      headers: { 'User-Agent': UA, 'Referer': 'https://music.163.com/', 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log('status:', res.status);
    console.log('response:', JSON.stringify(res.data).slice(0, 400));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

// 测试3: 用 cookie 调 weapi
async function testWithCookie() {
  console.log('\n=== 测试3: 网易云 weapi + cookie ===');
  try {
    const cookie = 'MUSIC_U=test';  // 假 cookie
    const modulus = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
    const nonce = '0CoJUm6Qyw8W8jud';
    const pubKey = '010001';
    const text = JSON.stringify({ s: '周杰伦', offset: 0, limit: 3, type: 1 });
    const secKey = Array.from({ length: 16 }, () => '012345679abcdef'[Math.floor(Math.random() * 16)]).join('');

    const c1 = forge.cipher.createCipher('AES-CBC', nonce);
    c1.start({ iv: '0102030405060708' });
    c1.update(forge.util.createBuffer(text));
    c1.finish();
    const first = forge.util.encode64(c1.output.data);

    const c2 = forge.cipher.createCipher('AES-CBC', secKey);
    c2.start({ iv: '0102030405060708' });
    c2.update(forge.util.createBuffer(first));
    c2.finish();
    const encText = forge.util.encode64(c2.output.data);

    const reversed = secKey.split('').reverse().join('');
    const n = new forge.jsbn.BigInteger(modulus, 16);
    const e = new forge.jsbn.BigInteger(pubKey, 16);
    const b = new forge.jsbn.BigInteger(forge.util.bytesToHex(reversed), 16);
    const encSecKey = b.modPow(e, n).toString(16).padStart(256, '0');

    const url = 'https://music.163.com/weapi/search/get';
    const res = await axios.post(url, new URLSearchParams({ params: encText, encSecKey }).toString(), {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://music.163.com/',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
      },
    });
    console.log('status:', res.status);
    console.log('response:', JSON.stringify(res.data).slice(0, 400));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

(async () => {
  await testPublic();
  await testWeapi();
  await testWithCookie();
})();

// 测试完整播放链路: 搜索 → 获取地址
const axios = require('axios');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 网易云 weapi 加密
function weapi(object) {
  const modulus = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
  const nonce = '0CoJUm6Qyw8W8jud';
  const pubKey = '010001';
  const text = JSON.stringify(object);
  const secKey = Array.from({ length: 16 }, () => '012345679abcdef'[Math.floor(Math.random() * 16)]).join('');

  const forge = require('node-forge');
  const cipher = forge.cipher.createCipher('AES-CBC', nonce);
  cipher.start({ iv: '0102030405060708' });
  cipher.update(forge.util.createBuffer(text));
  cipher.finish();
  const first = forge.util.encode64(cipher.output.data);

  const cipher2 = forge.cipher.createCipher('AES-CBC', secKey);
  cipher2.start({ iv: '0102030405060708' });
  cipher2.update(forge.util.createBuffer(first));
  cipher2.finish();
  const encText = forge.util.encode64(cipher2.output.data);

  const reversed = secKey.split('').reverse().join('');
  const n = new forge.jsbn.BigInteger(modulus, 16);
  const e = new forge.jsbn.BigInteger(pubKey, 16);
  const b = new forge.jsbn.BigInteger(forge.util.bytesToHex(reversed), 16);
  const encSecKey = b.modPow(e, n).toString(16).padStart(256, '0');

  return { params: encText, encSecKey };
}

async function testNetease() {
  console.log('\n=== 网易云完整播放链路 ===');

  // 1. 搜索
  const searchUrl = 'https://music.163.com/weapi/search/get';
  const searchData = weapi({ s: '周杰伦', offset: 0, limit: 3, type: 1 });
  const searchRes = await axios.post(searchUrl, new URLSearchParams(searchData).toString(), {
    headers: { 'User-Agent': UA, 'Referer': 'https://music.163.com/', 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const songs = searchRes.data.result?.songs;
  if (!songs || songs.length === 0) {
    console.log('搜索无结果:', JSON.stringify(searchRes.data).slice(0, 300));
    return;
  }

  const firstSong = songs[0];
  console.log('搜索成功:', firstSong.name, '-', firstSong.artists[0].name);
  const trackId = `netrack_${firstSong.id}`;

  // 2. 获取播放地址
  const eapiUrl = '/api/song/enhance/player/url';
  const targetUrl = 'https://interface3.music.163.com/eapi/song/enhance/player/url';
  const eapiKey = 'e82ckenh8dichen8';
  const text = JSON.stringify({ ids: `[${firstSong.id}]`, br: 999000 });
  const message = `nobody${eapiUrl}use${text}md5forencrypt`;
  const digest = crypto.createHash('md5').update(message).digest('hex');
  const data = `${eapiUrl}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;

  const forge = require('node-forge');
  const cipher = forge.cipher.createCipher('AES-ECB', eapiKey);
  cipher.start();
  cipher.update(forge.util.createBuffer(data));
  cipher.finish();
  const params = cipher.output.toHex().toUpperCase();

  const playRes = await axios.post(targetUrl, new URLSearchParams({ params }).toString(), {
    headers: { 'User-Agent': UA, 'Referer': 'https://music.163.com/', 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  console.log('播放地址响应:', JSON.stringify(playRes.data).slice(0, 300));
  const url = playRes.data.data?.[0]?.url;
  console.log('播放地址:', url ? url.slice(0, 80) + '...' : 'NULL');
}

testNetease().catch(e => console.log('ERROR:', e.message));

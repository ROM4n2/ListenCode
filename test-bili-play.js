const axios = require('axios');

const BILI_URL = 'https://809al93l.edge.mountaintoys.cn:4483/upgcxcode/99/91/137649199/137649199_da2-1-16.mp4?e=ig8euxZM2rNcNbRVhwdVhwdlhWdVhwdVhCk5ZqPCF0wuhwNLrN1cLnHD1LHrV0ifHDr1UdH8KEqjqMyqdwf1YbOCh7E6YaPDefhXF6UqYSeWCl5oDqhUfe&oi=1696657560&platform=pc&mid=0&gen=playurlv3&og=cos&deadline=1785572909&nbs=1&trid=8f2b621544d84e40a6d2f8c57c45bb03u&os=upos&upsig=97c5d021e2d21a3afe5e07ff248a7e18&uparams=e,oi,platform,mid,gen,og,deadline,nbs,trid,os&cdnid=61001&bvc=vod&nettype=0&f=u_0_0&bw=267634&orderid=0,2&agrr=0&uipk=5&uf=53e1343114948a88bf32f709e9d0fb71';

async function test() {
  console.log('URL:', BILI_URL.slice(0, 80));

  // 测试1: 只带 Referer
  console.log('\n--- 测试1: fetch 只带 Referer ---');
  try {
    const res = await axios.get(BILI_URL, {
      headers: { 'Referer': 'https://www.bilibili.com/' },
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 15000,
    });
    console.log('✅ 成功:', res.status, 'size:', res.data.length, 'type:', res.headers['content-type']);
  } catch (e) {
    console.log('❌ 失败:', e.message);
  }

  // 测试2: 带完整 headers（模拟浏览器）
  console.log('\n--- 测试2: fetch 带完整 headers ---');
  try {
    const res = await axios.get(BILI_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Origin': 'https://www.bilibili.com',
        'Accept': '*/*',
        'Range': 'bytes=0-1048575',  // 只取前1MB
      },
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 15000,
    });
    console.log('✅ 成功:', res.status, 'size:', res.data.length, 'type:', res.headers['content-type']);
  } catch (e) {
    console.log('❌ 失败:', e.message);
  }

  // 测试3: 带 buvid cookie
  console.log('\n--- 测试3: fetch 带 buvid cookie ---');
  try {
    const res = await axios.get(BILI_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.bilibili.com/',
        'Cookie': 'buvid3=ABCD1234-5678-ABCD-1234-5678ABCD1234-00000000-00000000; b_nut=1700000000',
      },
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 15000,
    });
    console.log('✅ 成功:', res.status, 'size:', res.data.length);
  } catch (e) {
    console.log('❌ 失败:', e.message);
  }
}

test().catch(e => console.log('FATAL:', e.message));

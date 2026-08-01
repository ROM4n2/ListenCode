const axios = require('axios');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

(async () => {
  const url = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp';
  const params = {
    format: 'json', p: 1, n: 3, w: '周杰伦', cr: 1, g_tk: 5381,
    loginUin: 0, hostUin: 0, inCharset: 'utf8', outCharset: 'utf-8',
    notice: 0, platform: 'yqq', needNewCode: 0,
  };
  const res = await axios.get(url, {
    params,
    headers: { 'User-Agent': UA, 'Referer': 'https://y.qq.com/' },
  });
  // 打印第一个 song 的所有 key
  const first = res.data.data?.song?.list?.[0];
  if (first) {
    console.log('ALL KEYS:', Object.keys(first));
    console.log('FULL FIRST SONG:', JSON.stringify(first, null, 2));
  }
})();

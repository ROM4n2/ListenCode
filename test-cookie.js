const axios = require('axios');
const { weapi } = require('./out/provider/crypto');
const crypto = require('crypto');

async function test() {
  const nuid = crypto.randomBytes(16).toString('hex');
  const nnid = nuid + ',' + Date.now();
  const cookie = `_ntes_nuid=${nuid}; _ntes_nnid=${nnid}; NMTID=0;`;

  const searchUrl = 'https://music.163.com/weapi/search/get';
  const data = weapi({ s: '周杰伦', offset: 0, limit: 3, type: 1 });
  const res = await axios.post(searchUrl, new URLSearchParams(data).toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://music.163.com/',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookie,
    },
  });
  console.log('status:', res.status);
  console.log('response:', JSON.stringify(res.data).slice(0, 400));
}

test().catch(e => console.log('ERROR:', e.message));

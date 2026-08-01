// 测试修复方案
const axios = require('axios');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 酷狗 - 用 wwwapi 新接口（带签名）
async function testKugouNew() {
  console.log('\n=== 酷狗新播放接口 ===');
  try {
    const hash = 'B3A52A7A958BF0AED0EBFBA2E9A818B7';
    const mid = '1234567890abcdef1234567890abcdef';
    const url = 'https://wwwapi.kugou.com/yy/index.php';

    const params = {
      r: 'play/getdata',
      hash,
      mid,
      platid: 4,
    };

    // 签名: KG_SIGNATURE = md5(r + hash + mid + platid + key)
    const sigStr = `r=${params.r}&hash=${params.hash}&mid=${params.mid}&platid=${params.platid}kgcloud`;
    const sig = crypto.createHash('md5').update(sigStr).digest('hex');
    params['signature'] = sig;

    const res = await axios.get(url, {
      params,
      headers: { 'User-Agent': UA, 'Referer': 'https://www.kugou.com/' },
    });
    console.log('status:', res.status);
    console.log('data keys:', Object.keys(res.data.data || {}));
    console.log('play url:', res.data.data?.play_url?.slice(0, 100));
    console.log('img:', res.data.data?.img?.slice(0, 80));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

// 酷狗 - 移动端接口带 cookie
async function testKugouMobile() {
  console.log('\n=== 酷狗移动端（带 cookie）===');
  try {
    const hash = 'B3A52A7A958BF0AED0EBFBA2E9A818B7';
    const kg_mid = '250e488943bdb8b275ec791e00ac7e12';
    const url = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;

    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Referer': 'https://m.kugou.com/',
        'Cookie': `kg_mid=${kg_mid}`,
      },
    });
    console.log('status:', res.status);
    console.log('api status:', res.data.status);
    console.log('url exists:', !!res.data.url);
    console.log('url:', res.data.url?.slice(0, 100));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

// QQ - 换参数
async function testQQNew() {
  console.log('\n=== QQ音乐搜索（调整参数）===');
  try {
    const url = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp';
    const params = {
      format: 'json',
      p: 1,
      n: 3,
      w: '周杰伦',
      cr: 1,
      g_tk: 5381,
      jsonpCallback: '',
      loginUin: 0,
      hostUin: 0,
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq',
      needNewCode: 0,
    };
    const res = await axios.get(url, {
      params,
      headers: { 'User-Agent': UA, 'Referer': 'https://y.qq.com/' },
    });
    console.log('status:', res.status);
    console.log('code:', res.data.code);
    const list = res.data.data?.song?.list ?? [];
    console.log('result count:', list.length);
    if (list.length > 0) {
      console.log('first song:', list[0].name, '-', list[0].singer?.[0]?.name);
      console.log('songmid:', list[0].mid);
    } else {
      console.log('FULL:', JSON.stringify(res.data).slice(0, 400));
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

// B站 - 加 buvid 和完整 header
async function testBiliNew() {
  console.log('\n=== B站搜索（完整 header）===');
  try {
    const url = 'https://api.bilibili.com/x/web-interface/search/type';
    const params = {
      search_type: 'video',
      keyword: '周杰伦 音乐',
      page: 1,
      pagesize: 3,
    };
    const res = await axios.get(url, {
      params,
      headers: {
        'User-Agent': UA,
        'Referer': 'https://search.bilibili.com/',
        'Origin': 'https://search.bilibili.com',
        'Accept': 'application/json, text/plain, */*',
        'Cookie': `buvid3=${crypto.randomBytes(8).toString('hex')}_${Date.now()}; b_nut=${Math.floor(Date.now()/1000)}`,
      },
    });
    console.log('status:', res.status);
    console.log('code:', res.data.code);
    const results = res.data.data?.result ?? [];
    console.log('result count:', results.length);
    if (results.length > 0) {
      console.log('first:', results[0].title?.replace(/<[^>]+>/g, ''), '-', results[0].author);
    } else {
      console.log('FULL:', JSON.stringify(res.data).slice(0, 400));
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

(async () => {
  await testKugouNew();
  await testKugouMobile();
  await testQQNew();
  await testBiliNew();
})();

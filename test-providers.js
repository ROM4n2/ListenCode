// 直接测试各平台 API 返回
// 运行: node test-providers.js
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testNetease() {
  console.log('\n=== 网易云搜索 ===');
  try {
    // 简单搜索（不走 weapi 加密，看公开接口）
    const url = 'https://music.163.com/api/search/pc';
    const res = await axios.post(url, new URLSearchParams({
      s: '周杰伦',
      offset: 0,
      limit: 3,
      type: 1,
    }), {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://music.163.com/',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    console.log('status:', res.status);
    console.log('songCount:', res.data.result?.songCount);
    const songs = res.data.result?.songs ?? [];
    if (songs.length > 0) {
      console.log('first song:', songs[0].name, '-', songs[0].artists[0].name);
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

async function testQQ() {
  console.log('\n=== QQ音乐搜索 ===');
  try {
    const url = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp';
    const params = {
      ct: 24,
      qqmusic_ver: 1298,
      new_json: 1,
      remoteplace: 'txt.yqq.song',
      searchid: 12345,
      t: 0,
      aggr: 1,
      cr: 1,
      catZhida: 1,
      lossless: 0,
      flag_qc: 0,
      p: 1,
      n: 3,
      w: '周杰伦',
      format: 'json',
    };
    const res = await axios.get(url, {
      params,
      headers: { 'User-Agent': UA, 'Referer': 'https://y.qq.com/' },
    });
    console.log('status:', res.status);
    console.log('code:', res.data.code);
    console.log('data keys:', Object.keys(res.data.data || {}));
    const list = res.data.data?.song?.list ?? [];
    console.log('result count:', list.length);
    if (list.length > 0) {
      console.log('first song:', list[0].name, '-', list[0].singer?.[0]?.name);
    } else {
      console.log('FULL RESPONSE:', JSON.stringify(res.data).slice(0, 500));
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

async function testKugou() {
  console.log('\n=== 酷狗搜索 ===');
  try {
    const url = 'https://songsearch.kugou.com/song_search_v2';
    const params = {
      keyword: '周杰伦',
      page: 1,
      pagesize: 3,
      userid: -1,
      clientver: '',
      platform: 'WebFilter',
      tag: 'em',
      filter: 2,
      iscorrection: 1,
      privilege_filter: 0,
    };
    const res = await axios.get(url, {
      params,
      headers: { 'User-Agent': UA, 'Referer': 'https://www.kugou.com/' },
    });
    console.log('status:', res.status);
    console.log('api status:', res.data.status);
    const lists = res.data.data?.lists ?? [];
    console.log('result count:', lists.length);
    if (lists.length > 0) {
      console.log('first song:', lists[0].SongName, '-', lists[0].SingerName);
      console.log('FileHash:', lists[0].FileHash);

      // 测试播放地址
      console.log('\n=== 酷狗播放地址 ===');
      const hash = lists[0].FileHash;
      const playUrl = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
      const playRes = await axios.get(playUrl, {
        headers: { 'User-Agent': UA, 'Referer': 'https://www.kugou.com/' },
      });
      console.log('play api status:', playRes.data.status);
      console.log('url exists:', !!playRes.data.url);
      console.log('url:', playRes.data.url?.slice(0, 80));
    } else {
      console.log('FULL RESPONSE:', JSON.stringify(res.data).slice(0, 500));
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

async function testBilibili() {
  console.log('\n=== B站搜索 ===');
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
      headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' },
    });
    console.log('status:', res.status);
    console.log('code:', res.data.code);
    const results = res.data.data?.result ?? [];
    console.log('result count:', results.length);
    if (results.length > 0) {
      const first = results[0];
      console.log('first:', first.title, '-', first.author);
      console.log('bvid:', first.bvid);

      // 测试播放地址
      console.log('\n=== B站播放地址 ===');
      const infoRes = await axios.get('https://api.bilibili.com/x/web-interface/view', {
        params: { bvid: first.bvid },
        headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' },
      });
      const cid = infoRes.data.data?.cid;
      console.log('cid:', cid);

      const playRes = await axios.get('https://api.bilibili.com/x/player/playurl', {
        params: { bvid: first.bvid, cid, fnval: 16, qn: 0 },
        headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' },
      });
      console.log('playurl code:', playRes.data.code);
      const audioList = playRes.data.data?.dash?.audio;
      console.log('audio tracks:', audioList?.length);
      if (audioList && audioList.length > 0) {
        console.log('audio url:', audioList[0].baseUrl?.slice(0, 100));
      } else {
        console.log('FULL PLAYURL:', JSON.stringify(playRes.data).slice(0, 600));
      }
    } else {
      console.log('FULL RESPONSE:', JSON.stringify(res.data).slice(0, 500));
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

(async () => {
  await testNetease();
  await testQQ();
  await testKugou();
  await testBilibili();
})();

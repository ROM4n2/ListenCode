(function () {
  const vscode = acquireVsCodeApi();

  const searchInput = document.getElementById('searchInput');
  const platformSelect = document.getElementById('platformSelect');
  const searchBtn = document.getElementById('searchBtn');
  const searchResults = document.getElementById('searchResults');
  const cookieStatus = document.getElementById('cookieStatus');
  const playlistList = document.getElementById('playlistList');
  const newPlaylistBtn = document.getElementById('newPlaylistBtn');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progressBar = document.getElementById('progressBar');
  const volumeBar = document.getElementById('volumeBar');
  const currentTimeEl = document.getElementById('currentTime');
  const totalTimeEl = document.getElementById('totalTime');
  const currentTrackTitle = document.getElementById('currentTrackTitle');
  const currentTrackArtist = document.getElementById('currentTrackArtist');
  const audioPlayer = document.getElementById('audioPlayer');

  let currentTrack = null;
  let currentPlaylist = [];
  let currentIndex = -1;
  let playlists = [];

  // 搜索
  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {doSearch();}
  });

  function doSearch() {
    const keyword = searchInput.value.trim();
    if (!keyword) {return;}
    const platform = platformSelect.value;
    const sources = platform === 'all'
      ? ['netease', 'qq', 'kugou', 'bilibili']
      : [platform];
    vscode.postMessage({ type: 'search', keyword, sources });
  }

  // 播放控制
  playPauseBtn.addEventListener('click', togglePlayPause);
  prevBtn.addEventListener('click', playPrev);
  nextBtn.addEventListener('click', playNext);

  audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
      const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
      progressBar.value = progress;
      currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    }
  });

  audioPlayer.addEventListener('loadedmetadata', () => {
    totalTimeEl.textContent = formatTime(audioPlayer.duration);
  });

  audioPlayer.addEventListener('ended', () => {
    playNext();
  });

  progressBar.addEventListener('input', () => {
    if (audioPlayer.duration) {
      audioPlayer.currentTime = (progressBar.value / 100) * audioPlayer.duration;
    }
  });

  volumeBar.addEventListener('input', () => {
    audioPlayer.volume = volumeBar.value / 100;
  });

  function togglePlayPause() {
    if (!currentTrack) {return;}
    if (audioPlayer.paused) {
      audioPlayer.play();
      playPauseBtn.textContent = '⏸';
    } else {
      audioPlayer.pause();
      playPauseBtn.textContent = '▶';
    }
  }

  function playNext() {
    if (currentPlaylist.length === 0) {return;}
    currentIndex = (currentIndex + 1) % currentPlaylist.length;
    playTrack(currentPlaylist[currentIndex]);
  }

  function playPrev() {
    if (currentPlaylist.length === 0) {return;}
    currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    playTrack(currentPlaylist[currentIndex]);
  }

  function playTrack(track) {
    currentTrack = track;
    currentTrackTitle.textContent = track.title;
    currentTrackArtist.textContent = track.artist;
    vscode.postMessage({ type: 'play', track });
  }

  function addToPlaylist(track) {
    if (playlists.length === 0) {
      const pl = { id: 'default', name: '默认歌单', tracks: [] };
      playlists.push(pl);
      renderPlaylists();
    }
    vscode.postMessage({ type: 'playlist:add', playlistId: playlists[0].id, track });
  }

  // 歌单
  newPlaylistBtn.addEventListener('click', () => {
    const name = prompt('歌单名称:');
    if (name) {
      vscode.postMessage({ type: 'playlist:create', name });
    }
  });

  // 接收消息
  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'search:result':
        renderTracks(msg.tracks);
        break;
      case 'player:status':
        updatePlayerStatus(msg);
        break;
      case 'playlist:list':
        playlists = msg.playlists;
        renderPlaylists();
        break;
      case 'cookie:status':
        renderCookieStatus(msg.status);
        break;
      case 'player:resolve':
        if (msg.url) {
          audioPlayer.src = msg.url;
          audioPlayer.play().then(() => {
            playPauseBtn.textContent = '⏸';
          }).catch((err) => {
            showError('播放失败: ' + err.message);
          });
        } else {
          showError('无法获取播放地址（可能需要导入 Cookie）');
        }
        break;
      case 'error':
        showError(msg.message);
        break;
    }
  });

  function renderTracks(tracks) {
    if (tracks.length === 0) {
      searchResults.innerHTML = '<div class="empty-state">无结果</div>';
      return;
    }
    searchResults.innerHTML = tracks.map((t) => `
      <div class="track-item" data-id="${t.id}">
        <div class="track-info">
          <div class="track-title">${escapeHtml(t.title)}</div>
          <div class="track-artist">${escapeHtml(t.artist)} - ${escapeHtml(t.album)}</div>
        </div>
        <span class="track-source">${t.source}</span>
        <div class="track-actions">
          <button data-action="play" data-id="${t.id}">▶</button>
          <button data-action="add" data-id="${t.id}">+</button>
        </div>
      </div>
    `).join('');

    // 绑定事件
    searchResults.querySelectorAll('.track-item').forEach((el) => {
      const id = el.dataset.id;
      const track = tracks.find((t) => t.id === id);
      el.querySelector('[data-action="play"]').addEventListener('click', (e) => {
        e.stopPropagation();
        currentPlaylist = tracks;
        currentIndex = tracks.indexOf(track);
        playTrack(track);
      });
      el.querySelector('[data-action="add"]').addEventListener('click', (e) => {
        e.stopPropagation();
        addToPlaylist(track);
      });
    });
  }

  function renderPlaylists() {
    if (playlists.length === 0) {
      playlistList.innerHTML = '<div class="empty-state" style="padding:8px">暂无歌单</div>';
      return;
    }
    playlistList.innerHTML = playlists.map((p) => `
      <div class="playlist-item" data-id="${p.id}">
        <span>${escapeHtml(p.name)}</span>
        <span class="playlist-count">${p.tracks.length}首</span>
      </div>
    `).join('');
  }

  function renderCookieStatus(status) {
    const labels = { netease: '网易', qq: 'QQ', kugou: '酷狗', bilibili: 'B站' };
    cookieStatus.innerHTML = Object.entries(status).map(([k, v]) =>
      `<span class="cookie-dot ${v ? 'active' : ''}">${labels[k] || k}</span>`
    ).join('');
  }

  function updatePlayerStatus(status) {
    if (status.currentTrack) {
      currentTrackTitle.textContent = status.currentTrack.title;
      currentTrackArtist.textContent = status.currentTrack.artist;
    }
    playPauseBtn.textContent = status.playing ? '⏸' : '▶';
  }

  function showError(message) {
    searchResults.innerHTML = `<div class="empty-state" style="color:#f44336">错误: ${escapeHtml(message)}</div>`;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 初始化：加载歌单
  vscode.postMessage({ type: 'playlist:load' });
})();

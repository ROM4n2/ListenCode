(function () {
  const vscode = acquireVsCodeApi();

  const searchInput = document.getElementById('searchInput');
  const platformSelect = document.getElementById('platformSelect');
  const searchBtn = document.getElementById('searchBtn');
  const searchResults = document.getElementById('searchResults');
  const cookieStatus = document.getElementById('cookieStatus');
  const playlistList = document.getElementById('playlistList');
  const newPlaylistBtn = document.getElementById('newPlaylistBtn');
  const exportPlaylistsBtn = document.getElementById('exportPlaylistsBtn');
  const importPlaylistsBtn = document.getElementById('importPlaylistsBtn');
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');
  const clearQueueBtn = document.getElementById('clearQueueBtn');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const modeBtn = document.getElementById('modeBtn');
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
  let playableStatus = {}; // trackId -> boolean (是否可播)
  let playMode = 'list'; // 'list' | 'single' | 'shuffle'

  const MODE_ORDER = ['list', 'single', 'shuffle'];
  const MODE_LABEL = { list: '列表循环', single: '单曲循环', shuffle: '随机播放' };

  function updateModeBtn() {
    const idx = MODE_ORDER.indexOf(playMode);
    const nextMode = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    modeBtn.textContent = MODE_LABEL[playMode];
    modeBtn.title = `切换到: ${MODE_LABEL[nextMode]}`;
    modeBtn.classList.toggle('active', playMode !== 'list');
  }

  function cycleMode() {
    const idx = MODE_ORDER.indexOf(playMode);
    playMode = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    updateModeBtn();
    vscode.postMessage({ type: 'mode:set', mode: playMode });
  }

  modeBtn.addEventListener('click', cycleMode);

  // 搜索
  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {doSearch();}
  });
  // 输入时才显示历史（不是 focus），避免挡住搜索结果
  searchInput.addEventListener('input', () => {
    if (searchInput.value.trim() === '') {
      vscode.postMessage({ type: 'search:loadHistory' });
    }
  });

  // 搜索历史下拉
  const historyDropdown = document.createElement('div');
  historyDropdown.className = 'search-history-dropdown';
  historyDropdown.style.display = 'none';
  document.querySelector('.search-bar').appendChild(historyDropdown);

  function showHistoryDropdown(history) {
    // 输入框有内容时不下拉（避免和搜索结果混淆）
    if (!history || history.length === 0 || searchInput.value.trim() !== '') {
      historyDropdown.style.display = 'none';
      return;
    }
    historyDropdown.innerHTML = history.map((kw) =>
      `<div class="search-history-item">${escapeHtml(kw)}</div>`
    ).join('');
    historyDropdown.style.display = 'block';
    historyDropdown.querySelectorAll('.search-history-item').forEach((el) => {
      el.addEventListener('click', () => {
        searchInput.value = el.textContent;
        historyDropdown.style.display = 'none';
        doSearch();
      });
    });
  }

  document.addEventListener('click', (e) => {
    if (!document.querySelector('.search-bar').contains(e.target)) {
      historyDropdown.style.display = 'none';
    }
  });

  function doSearch() {
    const keyword = searchInput.value.trim();
    if (!keyword) {return;}
    historyDropdown.style.display = 'none';
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
      audioPlayer.play().then(() => {
        playPauseBtn.textContent = '⏸';
        sendPlayerState(true);
      }).catch((err) => {
        showError('播放失败: ' + err.message);
      });
    } else {
      audioPlayer.pause();
      playPauseBtn.textContent = '▶';
      sendPlayerState(false);
    }
  }

  function sendPlayerState(playing) {
    vscode.postMessage({ type: 'player:state', playing, track: currentTrack });
  }

  function playNext() {
    if (currentPlaylist.length === 0) {return;}
    if (playMode === 'single') {
      // 重播当前，index 不变
    } else if (playMode === 'shuffle') {
      currentIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
      currentIndex = (currentIndex + 1) % currentPlaylist.length;
    }
    playTrack(currentPlaylist[currentIndex]);
    renderQueue();
  }

  function playPrev() {
    if (currentPlaylist.length === 0) {return;}
    if (playMode === 'single') {
      // 重播当前，index 不变
    } else if (playMode === 'shuffle') {
      currentIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
      currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    }
    playTrack(currentPlaylist[currentIndex]);
    renderQueue();
  }

  function playTrack(track) {
    currentTrack = track;
    currentTrackTitle.textContent = track.title;
    currentTrackArtist.textContent = track.artist;
    vscode.postMessage({ type: 'play', track });
    renderQueue();
  }

  function renderQueue() {
    queueCount.textContent = currentPlaylist.length;
    if (currentPlaylist.length === 0) {
      queueList.innerHTML = '<div class="empty-state" style="padding:8px">队列为空</div>';
      return;
    }
    queueList.innerHTML = currentPlaylist.map((t, i) => `
      <div class="queue-item${i === currentIndex ? ' playing' : ''}" data-index="${i}">
        <span class="queue-title">${escapeHtml(t.title)}</span>
        <span class="queue-artist">${escapeHtml(t.artist)}</span>
        <button class="queue-remove" data-index="${i}" title="移除">×</button>
      </div>
    `).join('');

    queueList.querySelectorAll('.queue-item').forEach((el) => {
      const index = parseInt(el.dataset.index, 10);

      // 拖拽排序
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index);
        el.classList.add('dragging');
      });
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const to = index;
        if (from !== to) {
          const [removed] = currentPlaylist.splice(from, 1);
          currentPlaylist.splice(to, 0, removed);
          if (currentIndex === from) {currentIndex = to;}
          else if (from < to && currentIndex > from && currentIndex <= to) {currentIndex--;}
          else if (from > to && currentIndex >= to && currentIndex < from) {currentIndex++;}
          renderQueue();
        }
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach((d) => d.classList.remove('drag-over'));
      });

      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('queue-remove')) {return;}
        currentIndex = index;
        playTrack(currentPlaylist[index]);
      });
    });
    queueList.querySelectorAll('.queue-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        currentPlaylist.splice(idx, 1);
        if (idx === currentIndex) {
          if (currentPlaylist.length === 0) {
            currentIndex = -1;
            currentTrack = null;
            audioPlayer.pause();
            audioPlayer.src = '';
            currentTrackTitle.textContent = '未播放';
            currentTrackArtist.textContent = '';
            playPauseBtn.textContent = '▶';
          } else {
            currentIndex = idx < currentPlaylist.length ? idx : 0;
            playTrack(currentPlaylist[currentIndex]);
            return;
          }
        } else if (idx < currentIndex) {
          currentIndex--;
        }
        renderQueue();
      });
    });
  }

  clearQueueBtn.addEventListener('click', () => {
    currentPlaylist = [];
    currentIndex = -1;
    currentTrack = null;
    audioPlayer.pause();
    audioPlayer.src = '';
    currentTrackTitle.textContent = '未播放';
    currentTrackArtist.textContent = '';
    playPauseBtn.textContent = '▶';
    renderQueue();
    vscode.postMessage({ type: 'player:state', playing: false, track: null });
  });

  function addToPlaylist(track) {
    // 没有歌单则先创建，再添加
    if (playlists.length === 0) {
      vscode.postMessage({ type: 'playlist:createAndAdd', name: '默认歌单', track });
    } else {
      vscode.postMessage({ type: 'playlist:add', playlistId: playlists[0].id, track });
    }
  }

  // 歌单
  newPlaylistBtn.addEventListener('click', () => {
    const name = prompt('歌单名称:');
    if (name) {
      vscode.postMessage({ type: 'playlist:create', name });
    }
  });

  // 导入导出歌单
  exportPlaylistsBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'playlists:export' });
  });
  importPlaylistsBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'playlists:import' });
  });

  // 接收消息
  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'search:result':
        historyDropdown.style.display = 'none';
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
          const playSrc = (src) => {
            audioPlayer.src = src;
            audioPlayer.play().then(() => {
              playPauseBtn.textContent = '⏸';
              sendPlayerState(true);
            }).catch((err) => {
              showError('播放失败: ' + err.message);
            });
          };
          // blob 加载（带 cookie 解决 B站 CDN 防盗链），失败回退直接 src
          loadAudioBlob(msg.url, msg.cookie).then(blobUrl => playSrc(blobUrl)).catch(() => playSrc(msg.url));
        } else {
          // 付费/版权失败，自动跳过下一首
          if (currentPlaylist.length > 1) {
            showError('当前歌曲无法播放，跳过...');
            setTimeout(() => playNext(), 1000);
          } else {
            showError('无法播放（可能是付费歌曲或版权限制）');
          }
        }
        break;
      case 'autoplay':
        // 快速播放：自动填充搜索框、搜索并播放指定歌曲
        searchInput.value = msg.track.title;
        currentPlaylist = [msg.track];
        currentIndex = 0;
        playTrack(msg.track);
        break;
      case 'player:toggle':
        togglePlayPause();
        break;
      case 'playable:status':
        Object.assign(playableStatus, msg.status);
        updatePlayableUI();
        break;
      case 'search:history':
        showHistoryDropdown(msg.history);
        break;
      case 'mode:current':
        if (MODE_ORDER.includes(msg.mode)) {
          playMode = msg.mode;
          updateModeBtn();
        }
        break;
      case 'error':
        showError(msg.message);
        break;
    }
  });

  function renderTracks(tracks) {
    if (tracks.length === 0) {
      const noCookie = Object.values(cookieStatusObj).every(v => !v);
      const hint = noCookie
        ? '<div class="empty-state">无结果<br><small>提示：各平台需要导入 Cookie 才能搜索<br>Ctrl+Shift+P → ListenCode: Import Cookie</small></div>'
        : '<div class="empty-state">无结果<br><small>可能是版权限制，换首歌试试</small></div>';
      searchResults.innerHTML = hint;
      return;
    }
    searchResults.innerHTML = tracks.map((t) => {
      const unplayable = playableStatus[t.id] === false;
      return `
      <div class="track-item${unplayable ? ' unplayable' : ''}" data-id="${t.id}">
        <div class="track-info">
          <div class="track-title">${escapeHtml(t.title)}</div>
          <div class="track-artist">${escapeHtml(t.artist)} - ${escapeHtml(t.album)}</div>
        </div>
        <span class="track-source">${t.source}</span>
        <div class="track-actions">
          <button data-action="play" data-id="${t.id}"${unplayable ? ' disabled' : ''}>▶</button>
          <button data-action="add" data-id="${t.id}">+</button>
        </div>
      </div>
    `}).join('');

    // 绑定事件
    searchResults.querySelectorAll('.track-item').forEach((el) => {
      const id = el.dataset.id;
      const track = tracks.find((t) => t.id === id);
      el.querySelector('[data-action="play"]').addEventListener('click', (e) => {
        e.stopPropagation();
        // 已知不可播则拦截
        if (playableStatus[id] === false) {
          showError('该歌曲因版权原因无法播放');
          return;
        }
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

  // 根据当前 playableStatus 刷新 UI（不重新渲染列表）
  function updatePlayableUI() {
    searchResults.querySelectorAll('.track-item').forEach((el) => {
      const id = el.dataset.id;
      const playBtn = el.querySelector('[data-action="play"]');
      if (playableStatus[id] === false) {
        el.classList.add('unplayable');
        if (playBtn) {playBtn.disabled = true;}
      }
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

  let cookieStatusObj = {};
  function renderCookieStatus(status) {
    cookieStatusObj = status;
    const labels = { netease: '网易', qq: 'QQ', kugou: '酷狗', bilibili: 'B站' };
    const dots = Object.entries(status).map(([k, v]) =>
      `<span class="cookie-dot ${v ? 'active' : ''}">${labels[k] || k}</span>`
    ).join('');
    const loginBtn = '<button id="openLoginBtn" class="btn-small" style="margin-left:6px">登录</button>';
    cookieStatus.innerHTML = dots + loginBtn;
    const btn = document.getElementById('openLoginBtn');
    if (btn) {
      btn.addEventListener('click', () => vscode.postMessage({ type: 'open:login' }));
    }
  }

  function updatePlayerStatus(status) {
    if (status.currentTrack) {
      currentTrackTitle.textContent = status.currentTrack.title;
      currentTrackArtist.textContent = status.currentTrack.artist;
    }
    playPauseBtn.textContent = status.playing ? '⏸' : '▶';
  }

  // 错误提示（不覆盖搜索结果，用临时 toast）
  // 用 blob 加载音频（带 cookie 解决 B站 CDN 防盗链）
  function loadAudioBlob(url, cookie) {
    const headers = { 'Referer': 'https://www.bilibili.com/' };
    if (cookie) { headers['Cookie'] = cookie; }
    return fetch(url, { headers }).then(res => {
      if (!res.ok) {throw new Error('HTTP ' + res.status);}
      return res.blob();
    }).then(blob => URL.createObjectURL(blob));
  }

  function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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

  // 初始化：加载歌单 + 播放模式
  vscode.postMessage({ type: 'playlist:load' });
  vscode.postMessage({ type: 'mode:get' });
})();

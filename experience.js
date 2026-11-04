(() => {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const player = document.querySelector('#music-player');
  const audio = document.querySelector('#blog-audio');
  const playButton = document.querySelector('#music-play');
  const expandButton = document.querySelector('#music-expand');
  const panel = document.querySelector('#music-panel');
  const seek = document.querySelector('#music-seek');
  const volume = document.querySelector('#music-volume');
  const muteButton = document.querySelector('#music-mute');
  const repeatButton = document.querySelector('#music-repeat');
  const status = document.querySelector('#music-status');
  // 使用平台公开的播放地址，不将第三方歌曲下载到站点或改写其访问限制。
  const musicUrl = 'https://music.163.com/song/media/outer/url?id=1403318151.mp3';
  const icons = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM15 5h4v14h-4z"/></svg>',
    volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>',
    muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Zm5 4 5 6m0-6-5 6"/></svg>'
  };
  let wantsPlayback = false;
  let waitingForGesture = false;
  let playbackRequest = 0;
  let scrubbing = false;
  let introTimer;
  let observer;

  function paintRange(element, percent) {
    element.style.setProperty('--range-fill', `${Math.max(0, Math.min(100, percent))}%`);
  }
  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }
  function setStatus(text) {
    if (status.textContent !== text) status.textContent = text;
  }
  function updatePlayback() {
    const active = wantsPlayback && !audio.paused;
    player.classList.toggle('is-playing', active);
    playButton.innerHTML = wantsPlayback ? icons.pause : icons.play;
    playButton.setAttribute('aria-label', wantsPlayback ? '暂停音乐' : '播放音乐');
    playButton.title = wantsPlayback ? '暂停音乐' : '播放音乐';
  }
  function updateVolume() {
    const value = audio.muted ? 0 : Math.round(audio.volume * 100);
    volume.value = value;
    paintRange(volume, value);
    document.querySelector('#music-volume-value').textContent = `${value}%`;
    muteButton.innerHTML = audio.muted || value === 0 ? icons.muted : icons.volume;
    muteButton.setAttribute('aria-label', audio.muted || value === 0 ? '取消静音' : '静音');
    muteButton.title = muteButton.getAttribute('aria-label');
    try { localStorage.setItem('zlog-music-volume', String(audio.volume)); } catch { /* 不可用时仍可正常播放。 */ }
  }
  function updateProgress() {
    const validDuration = Number.isFinite(audio.duration) && audio.duration > 0;
    seek.disabled = !validDuration;
    if (validDuration) document.querySelector('#music-duration').textContent = formatTime(audio.duration);
    if (scrubbing) return;
    const fraction = validDuration ? audio.currentTime / audio.duration : 0;
    seek.value = Math.round(fraction * 1000);
    paintRange(seek, fraction * 100);
    document.querySelector('#music-elapsed').textContent = formatTime(audio.currentTime);
    seek.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)} / ${formatTime(validDuration ? audio.duration : 381)}`);
  }
  function clearAutoplayRetry() {
    waitingForGesture = false;
    document.removeEventListener('click', resumeAfterInteraction);
    document.removeEventListener('keydown', resumeAfterInteraction);
  }
  function resumeAfterInteraction(event) {
    if (!waitingForGesture || !event.isTrusted || event.defaultPrevented || event.target.closest('#music-play')) return;
    if (event.type === 'keydown' && (!['Enter', ' '].includes(event.key) || event.repeat)) return;
    clearAutoplayRetry();
    startPlayback(true);
  }
  function togglePlayback() {
    // 手动操作优先于自动播放；暂停后不再因点击正文而重新开始。
    clearAutoplayRetry();
    if (wantsPlayback) {
      ++playbackRequest;
      wantsPlayback = false;
      audio.pause();
      player.classList.remove('is-loading');
      setStatus('已暂停，故事可以慢慢听。');
      updatePlayback();
      return;
    }
    startPlayback();
  }
  async function startPlayback(automatic = false) {
    const request = ++playbackRequest;
    wantsPlayback = true;
    player.classList.add('is-loading');
    setStatus('正在连接音乐…');
    updatePlayback();
    if (!audio.getAttribute('src') || audio.error) {
      audio.src = musicUrl;
      audio.load();
    }
    try {
      await audio.play();
      if (request === playbackRequest) clearAutoplayRetry();
    } catch (error) {
      // 连续点击暂停会终止尚未完成的 play；旧请求不得覆盖新的播放状态。
      if (request !== playbackRequest || (error.name === 'AbortError' && !wantsPlayback)) return;
      wantsPlayback = false;
      player.classList.remove('is-loading');
      if (automatic && error.name === 'NotAllowedError') {
        // 浏览器可能禁止有声自动播放，只在真实用户交互中重试，不静音假播或轮询。
        waitingForGesture = true;
        document.addEventListener('click', resumeAfterInteraction);
        document.addEventListener('keydown', resumeAfterInteraction);
        setStatus('点击页面任意位置，开启背景音乐。');
      } else {
        clearAutoplayRetry();
        setStatus(error.name === 'NotAllowedError' ? '请再点一次播放，开启音乐。' : '暂时无法播放，请重试或在网易云音乐打开。');
        setExpanded(true);
      }
      updatePlayback();
    }
  }
  function setExpanded(expanded) {
    panel.hidden = !expanded;
    player.classList.toggle('is-expanded', expanded);
    expandButton.setAttribute('aria-expanded', String(expanded));
    expandButton.setAttribute('aria-label', expanded ? '收起音乐播放器' : '展开音乐播放器');
    document.querySelector('.music-track small span').textContent = expanded ? '· 点击收起' : '· 点击展开';
  }
  let initialVolume = .35;
  try {
    const saved = localStorage.getItem('zlog-music-volume');
    if (saved !== null && Number.isFinite(Number(saved))) initialVolume = Math.max(0, Math.min(1, Number(saved)));
  } catch { /* 隐私模式下沿用默认音量。 */ }
  audio.volume = initialVolume;
  audio.loop = true;
  updateVolume();
  playButton.addEventListener('click', togglePlayback);
  expandButton.addEventListener('click', () => setExpanded(panel.hidden));
  player.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { setExpanded(false); expandButton.focus(); }
  });
  volume.addEventListener('input', () => { audio.muted = false; audio.volume = Number(volume.value) / 100; updateVolume(); });
  muteButton.addEventListener('click', () => {
    if (audio.volume === 0) { audio.volume = .35; audio.muted = false; } else audio.muted = !audio.muted;
    updateVolume();
  });
  repeatButton.addEventListener('click', () => {
    audio.loop = !audio.loop;
    repeatButton.setAttribute('aria-pressed', String(audio.loop));
    repeatButton.setAttribute('aria-label', audio.loop ? '关闭单曲循环' : '开启单曲循环');
    setStatus(audio.loop ? '单曲循环已开启。' : '播放完这一首后停止。');
  });
  seek.addEventListener('input', () => {
    scrubbing = true;
    paintRange(seek, Number(seek.value) / 10);
    const target = audio.duration * Number(seek.value) / 1000;
    document.querySelector('#music-elapsed').textContent = formatTime(target);
    seek.setAttribute('aria-valuetext', `${formatTime(target)} / ${formatTime(audio.duration)}`);
  });
  seek.addEventListener('change', () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * Number(seek.value) / 1000;
    scrubbing = false;
    updateProgress();
  });
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('durationchange', updateProgress);
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('volumechange', updateVolume);
  audio.addEventListener('waiting', () => { if (wantsPlayback) { player.classList.add('is-loading'); setStatus('正在缓冲音乐…'); } });
  audio.addEventListener('playing', () => { if (audio.paused) return; clearAutoplayRetry(); wantsPlayback = true; player.classList.remove('is-loading'); setStatus('正在播放 · 把回忆拼好给你'); updatePlayback(); });
  audio.addEventListener('pause', () => { if (audio.paused) { wantsPlayback = false; player.classList.remove('is-loading'); setStatus('已暂停，故事可以慢慢听。'); updatePlayback(); } });
  audio.addEventListener('ended', () => { wantsPlayback = false; player.classList.remove('is-loading'); setStatus('这一首听完了，再听一次吧。'); updatePlayback(); });
  audio.addEventListener('error', () => {
    if (!audio.error) return;
    clearAutoplayRetry();
    wantsPlayback = false;
    player.classList.remove('is-loading');
    setStatus('暂时无法播放，请重试或在网易云音乐打开。');
    setExpanded(true);
    updatePlayback();
  });
  // 仅在整页进入时启动，文章路由切换沿用同一个播放器和用户暂停状态。
  startPlayback(true);

  function finishIntro() {
    clearTimeout(introTimer);
    delete document.documentElement.dataset.intro;
  }
  function playIntro() {
    if (motion.matches) return;
    finishIntro();
    // 清掉上次动画后再重播，点击“重播入场”也不会把内容永久遮住。
    void document.querySelector('#site-intro').offsetWidth;
    document.documentElement.dataset.intro = 'playing';
    introTimer = setTimeout(finishIntro, 1650);
  }
  document.querySelector('#replay-intro').addEventListener('click', playIntro);
  if (document.documentElement.dataset.intro) introTimer = setTimeout(finishIntro, 1650);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') finishIntro(); });

  function revealContent() {
    observer?.disconnect();
    if (motion.matches || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.dataset.reveal = 'visible';
        observer.unobserve(entry.target);
      });
    }, { threshold: .06 });
    document.querySelectorAll('.post-card,.about-card,.note-card,.closing-banner,.about-section').forEach((element, index) => {
      element.style.setProperty('--reveal-delay', `${index % 3 * 60}ms`);
      element.dataset.reveal = 'pending';
      observer.observe(element);
    });
  }
  document.addEventListener('blog:render', revealContent);
  revealContent();
  motion.addEventListener('change', () => {
    if (motion.matches) {
      finishIntro();
      observer?.disconnect();
      document.querySelectorAll('[data-reveal]').forEach(element => delete element.dataset.reveal);
    }
  });

  document.addEventListener('pointerdown', event => {
    if (motion.matches || event.button !== 0) return;
    const target = event.target.closest('button,.button,.filter,.tag-pill,.post-link,.desktop-nav a');
    if (!target || target.disabled) return;
    const bounds = target.getBoundingClientRect();
    const wave = document.createElement('span');
    const size = Math.max(bounds.width, bounds.height) * 2;
    wave.className = 'click-ripple';
    wave.setAttribute('aria-hidden', 'true');
    wave.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - bounds.left - size / 2}px;top:${event.clientY - bounds.top - size / 2}px`;
    if (getComputedStyle(target).position === 'static') target.classList.add('ripple-static');
    target.classList.add('ripple-host');
    target.append(wave);
    setTimeout(() => wave.remove(), 650);
    const sparkle = document.createElement('span');
    sparkle.className = 'click-sparkle';
    sparkle.textContent = '✦';
    sparkle.style.cssText = `left:${event.clientX}px;top:${event.clientY}px`;
    document.querySelector('#click-effects').append(sparkle);
    setTimeout(() => sparkle.remove(), 650);
  }, { passive: true });
})();

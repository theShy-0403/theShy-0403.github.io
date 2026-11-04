(() => {
  'use strict';
  const posts = [...(window.BLOG_POSTS || [])].sort((a, b) => b.date.localeCompare(a.date));
  const main = document.querySelector('#main');
  const dialog = document.querySelector('#search-dialog');
  const searchInput = document.querySelector('#search-input');
  const searchResults = document.querySelector('#search-results');
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
  const sun = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 13A8.8 8.8 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/></svg>';
  let route = { page: 'home' };
  let toastTimer;
  let firstRender = true;

  function esc(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function postUrl(post) { return `#/post/${encodeURIComponent(post.id)}`; }
  function tagUrl(tag) { return `#/tag/${encodeURIComponent(tag)}`; }
  function date(value) { return value.replaceAll('-', '.'); }
  function meta(post) {
    return `<div class="post-meta"><span class="category-label">${esc(post.category)}</span><span class="meta-divider"></span><time datetime="${esc(post.date)}">${date(post.date)}</time><span class="meta-divider reading-time"></span><span class="reading-time">${post.readTime} MIN READ</span></div>`;
  }
  function tagPills(tags) {
    return tags.map(tag => `<a class="tag-pill" href="${tagUrl(tag)}"># ${esc(tag)}</a>`).join('');
  }
  function card(post, index, total, filtered) {
    const featured = !filtered && post.featured;
    const wide = !filtered && total % 2 === 0 && index === total - 1;
    return `<article class="post-card${featured ? ' featured' : ''}${wide ? ' wide' : ''}">
      <a class="post-link" href="${postUrl(post)}">
        <div class="post-image"><img src="${coverUrl(post.cover)}" alt="" loading="lazy" width="800" height="480"></div>
        <div class="post-content">${featured ? '<span class="featured-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z"/></svg> EDITOR’S PICK · 精选</span>' : ''}
          ${meta(post)}<h3 class="post-title">${esc(post.title)}</h3><p class="post-excerpt">${esc(post.excerpt)}</p>
          <div class="post-bottom"><span class="post-tags">${post.tags.slice(0, 2).map(tag => `<span>#${esc(tag)}</span>`).join('')}</span><span class="post-arrow" aria-hidden="true">↗</span></div>
        </div>
      </a></article>`;
  }
  function hero() {
    return `<section class="anime-hero" aria-labelledby="hero-title">
      <img class="anime-hero-bg" src="./assets/anime-night-sky.jpg" alt="" width="1672" height="941" fetchpriority="high"><div class="hero-shade"></div>
      <div class="hero-meteors" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="hero-particles" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="--x:${(i*37+9)%100}%;--y:${(i*19+5)%95}%;--delay:${i*.7}s;--duration:${5+i%4}s"></i>`).join('')}</div>
      <div class="page-wrap hero-content"><div class="hero-copy"><div class="hero-badge"><span class="status-dot"></span>欢迎来到我的异想世界 <span aria-hidden="true">✦</span></div>
        <p class="hero-overline">ZHENGJINGREN’S PERSONAL BLOG</p><h1 id="hero-title">郑经人的<br><span>幻想手记<span class="hero-cursor" aria-hidden="true">_</span></span></h1>
        <p class="hero-description">在代码与日常之间，收集宇宙的微光。<br>愿每一份热爱，都能在这里找到回响。</p>
        <div class="hero-actions"><a class="button button-primary" href="#/articles">开启旅程 <span aria-hidden="true">↓</span></a><a class="button button-quiet" href="#/about">关于这个世界 <span aria-hidden="true">↗</span></a></div>
        <div class="hero-footnote"><span aria-hidden="true">✧</span> STAY CURIOUS. STAY A LITTLE WEIRD.</div>
      </div><div class="hero-coordinate" aria-hidden="true"><span>夜空の向こう</span><span>BEYOND THE NIGHT SKY</span></div></div>
      <a class="hero-scroll" href="#/articles" aria-label="向下探索文章"><span>SCROLL TO EXPLORE</span><span aria-hidden="true">⌄</span></a>
      <div class="hero-bottom"><span>EST. 2026 / MY LITTLE UNIVERSE</span><span>愿所有热爱，都有回响</span><span>CODE · LIFE · INSPIRATION</span></div>
    </section>`;
  }
  function coverUrl(cover) {
    const covers = { orbit:'anime-night.jpg',code:'anime-workspace.jpg',terminal:'anime-workspace.jpg',mountain:'anime-journey.jpg',coffee:'anime-journey.jpg' };
    return `./assets/${covers[cover] || `${esc(cover)}.svg`}`;
  }
  function sidebar() {
    const tags = [...new Set(posts.flatMap(post => post.tags))].slice(0, 9);
    return `<aside class="sidebar" aria-label="博客信息">
      <section class="about-card"><div class="mini-label"><span>THE SOUL OF THIS WORLD</span><span aria-hidden="true">✦</span></div><div class="avatar" aria-hidden="true"></div><h3>郑经人</h3><p class="handle">世界很大，保持一点天真。</p><p class="about-text">穿梭于代码与幻想之间，<br>记录日常的微光，<br>收藏每一个心动瞬间。</p><a class="about-link" href="#/about">认识这个世界的主人 <span aria-hidden="true">↗</span></a></section>
      <section class="sidebar-section"><h3>灵感索引 <span>EXPLORE TAGS</span></h3><div class="tag-cloud">${tagPills(tags)}</div></section>
      <section class="note-card"><div class="note-top"><span>A SMALL REMINDER</span><span aria-hidden="true">✳</span></div><p>不必等到一切准备好。<br>从一个小小的想法开始，<br>让热爱慢慢生长。</p><small>ONE STEP AT A TIME.</small></section>
    </aside>`;
  }
  function home(selectedCategory = '全部', selectedTag = '') {
    const filtered = selectedCategory !== '全部' || !!selectedTag;
    const visible = posts.filter(post => (selectedCategory === '全部' || post.category === selectedCategory) && (!selectedTag || post.tags.includes(selectedTag)));
    const filterButtons = ['全部', '开发', '设计', '随笔'].map(category => {
      const count = category === '全部' ? posts.length : posts.filter(post => post.category === category).length;
      return `<button class="filter${selectedCategory === category && !selectedTag ? ' active' : ''}" data-category="${category}" aria-pressed="${selectedCategory === category && !selectedTag}">${category}<sup>${String(count).padStart(2, '0')}</sup></button>`;
    }).join('');
    main.innerHTML = `${filtered ? '' : hero()}<div class="page-wrap journal-wrap">${filtered ? '' : '<div class="interest-bar" aria-label="博客主题"><div class="interest-title">✦ A GARDEN OF LITTLE WONDERS</div><div class="interest-topics"><span>CODE / 代码碎片</span><span class="topic-separator">✧</span><span>LIFE / 日常漫游</span><span class="topic-separator">✧</span><span>IDEAS / 灵感收集</span></div></div>'}
      <section id="journal" aria-labelledby="journal-title"><div class="section-heading"><div><div class="eyebrow">${filtered ? 'EXPLORE THE UNIVERSE' : 'LET THE STORIES BEGIN'}</div><h2 id="journal-title">${selectedTag ? `# ${esc(selectedTag)}` : selectedCategory !== '全部' ? `${esc(selectedCategory)}记录` : '最近的碎碎念'}<span style="color:var(--lime)"> ✦</span></h2></div><span class="heading-note">${String(visible.length).padStart(2, '0')} STORIES IN THIS UNIVERSE</span></div>
      <div class="journal-layout"><div><div class="filters" aria-label="按分类筛选文章">${filterButtons}${selectedTag ? '<button class="filter active" data-category="全部">清除标签 ×</button>' : ''}</div>
      <div class="article-grid">${visible.length ? visible.map((post, index) => card(post, index, visible.length, filtered)).join('') : '<div class="empty-state"><h3>这里还没有记录</h3><p>换一个分类，继续探索吧。</p></div>'}</div>
      <p class="sample-note"><span>DEMO</span>当前文章为示例内容，可以替换成你自己的记录。</p><div class="journal-end">${filtered ? '发现更多，保持好奇' : '记录还在继续，故事慢慢发生'}</div></div>${sidebar()}</div></section>
      <section class="closing-banner"><div><h2>故事未完，星河长明。</h2><p>下一次相遇，希望又能带来一点新的灵感。</p></div><span class="banner-symbol" aria-hidden="true">✧</span></section></div>`;
  }
  function archive() {
    const years = [...new Set(posts.map(post => post.date.slice(0, 4)))];
    main.innerHTML = `<div class="page-wrap inner-page"><div class="page-kicker">THE ARCHIVE / 所有记录</div><h1 class="page-title">每一篇，都是足迹<span style="color:var(--lime)">.</span></h1><p class="page-intro">把时间折叠成目录，随时回到一个想法开始的地方。</p><p class="archive-summary">共 ${posts.length} 篇示例记录 · ${new Set(posts.map(post => post.category)).size} 个分类 · ${new Set(posts.flatMap(post => post.tags)).size} 个标签</p>
      ${years.map(year => `<section class="archive-year" aria-label="${year} 年文章"><h2>${year}</h2><div class="archive-list">${posts.filter(post => post.date.startsWith(year)).map(post => `<a class="archive-item" href="${postUrl(post)}"><time datetime="${post.date}">${post.date.slice(5).replace('-', '.')}</time><h3>${esc(post.title)}</h3><span class="archive-category">${esc(post.category)}</span><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`).join('')}
      <p class="sample-note"><span>DEMO</span>这些是搭建时的示例文章，更新内容后归档会自动整理。</p></div>`;
  }
  function about() {
    main.innerHTML = `<div class="page-wrap inner-page"><section class="about-hero"><div><div class="page-kicker">A NOTE ABOUT THIS SPACE</div><h1 class="page-title">你好，我是郑经人。<br>很高兴，在这里遇见你。</h1><p class="page-intro">欢迎来到我的数字花园。<br>这个小小的空间，留给代码、设计，以及生活中那些值得停下来想一想的瞬间。</p><a class="button button-primary" href="#/articles" style="margin-top:17px">读一篇文章 ${arrow}</a></div><section class="about-art solar-system" aria-label="我的小宇宙"><div class="solar-heading"><span class="solar-kicker">A LITTLE UNIVERSE</span><span class="solar-title">我的小宇宙<span aria-hidden="true">✦</span></span></div><div class="solar-stage"><canvas class="solar-canvas" role="img" aria-label="三维太阳系，点击卡片可放大探索。">太阳和八颗行星。</canvas></div><button class="solar-expand" type="button" aria-label="放大探索太阳系"><span class="solar-hint">正在唤醒星空…</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></button><div class="solar-caption"><span><i aria-hidden="true"></i>保持好奇，继续探索。</span><span>SOLAR SYSTEM</span></div></section></section>
      <div class="about-sections"><section class="about-section"><span>01 / CODE</span><h2>用代码构建</h2><p>从一个想法到一件可以使用的作品。这里可以记录开发中的问题、解决过程，以及让体验变得更好的小细节。</p></section><section class="about-section"><span>02 / DESIGN</span><h2>用设计表达</h2><p>关注秩序、留白和交互的温度。好的设计让信息更清晰，也让每一次使用多一点恰到好处的感受。</p></section><section class="about-section"><span>03 / LIFE</span><h2>用文字记录</h2><p>灵感不只来自屏幕。一段随笔、一次观察、一个尚未想明白的问题，都可以在这里找到自己的位置。</p></section></div>
      <div class="about-note">这个博客刚刚开始生长。目前展示的文章是用于体验排版与功能的示例内容。「关于」页的介绍也可以按你的真实经历继续完善。</div></div>`;
  }
  function article(id) {
    const post = posts.find(item => item.id === id);
    if (!post) {
      main.innerHTML = '<div class="page-wrap inner-page"><div class="empty-state"><h1>这篇记录还没找到</h1><p>链接可能已更新，可以回到首页继续探索。</p><a class="button button-primary" href="#/" style="margin-top:25px">返回首页</a></div></div>';
      document.title = '没有找到文章 · 郑经人';
      return;
    }
    document.title = `${post.title} · 郑经人`;
    // 正文来自站点作者维护的静态文件；搜索输入始终只作为文本参与匹配。
    const template = document.createElement('template');
    template.innerHTML = post.body;
    const headings = [...template.content.querySelectorAll('h2[id]')];
    const next = posts[(posts.indexOf(post) + 1) % posts.length];
    main.innerHTML = `<div class="page-wrap inner-page"><a class="article-back" href="#/articles">← <span>返回所有文章</span></a><div class="article-layout"><article><header class="article-header">${meta(post)}<h1>${esc(post.title)}</h1><p class="article-lead">${esc(post.excerpt)}</p><div class="tag-cloud">${tagPills(post.tags)}</div></header><img class="article-cover" src="${coverUrl(post.cover)}" alt="" width="800" height="480"><div class="article-body">${post.body}</div><a class="next-article" href="${postUrl(next)}"><div><small>继续探索 / NEXT STORY</small><h2>${esc(next.title)}</h2></div><span aria-hidden="true">↗</span></a></article>
      <aside class="article-aside"><nav class="toc" aria-label="文章目录"><h2>ON THIS PAGE / 目录</h2>${headings.map(heading => `<a href="${postUrl(post)}" data-section="${esc(heading.id)}">${esc(heading.textContent)}</a>`).join('')}<div class="article-tools"><button id="copy-link">复制文章链接 ↗</button><p>这是一篇示例文章。<br>感谢你花时间阅读。</p></div></nav></aside></div></div>`;
  }
  function render() {
    let parts;
    try { parts = (location.hash.slice(1) || '/').split('/').filter(Boolean).map(decodeURIComponent); }
    catch { parts = []; }
    route = { page: parts[0] || 'home', value: parts[1] || '' };
    document.title = '郑经人 · 记录灵感，构建热爱';
    document.querySelector('#mobile-nav').hidden = true;
    document.querySelector('#mobile-menu-toggle').setAttribute('aria-expanded', 'false');
    if (route.page === 'post') article(route.value);
    else if (route.page === 'archive') archive();
    else if (route.page === 'about') about();
    else if (route.page === 'category') home(route.value);
    else if (route.page === 'tag') home('全部', route.value);
    else home();
    const current = ['category', 'tag', 'post'].includes(route.page) ? 'articles' : route.page;
    document.querySelectorAll('[data-nav]').forEach(link => {
      const active = link.dataset.nav === current;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    if (route.page === 'articles') {
      requestAnimationFrame(() => document.querySelector('#journal')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    } else window.scrollTo({ top: 0, behavior: 'instant' });
    if (!firstRender) main.focus({ preventScroll: true });
    firstRender = false;
    updateScroll();
    document.dispatchEvent(new Event('blog:render'));
  }
  function search(value = '') {
    const query = value.trim().toLocaleLowerCase();
    const matches = posts.filter(post => `${post.title} ${post.excerpt} ${post.category} ${post.tags.join(' ')} ${post.body.replace(/<[^>]*>/g, ' ')}`.toLocaleLowerCase().includes(query));
    searchResults.innerHTML = matches.length ? matches.map(post => `<a class="search-result" href="${postUrl(post)}"><h3>${esc(post.title)} <span aria-hidden="true">↗</span></h3><p>${esc(post.category)} · ${date(post.date)} · ${post.tags.map(esc).join(' / ')}</p></a>`).join('') : '<p class="search-empty">没有找到相关记录，试试「Flutter」「设计」或「生活」。</p>';
  }
  function openSearch() {
    if (dialog.open) return;
    searchInput.value = '';
    search();
    dialog.showModal();
    searchInput.focus();
  }
  function toast(message) {
    const element = document.querySelector('#toast');
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('visible'), 2800);
  }
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const button = document.querySelector('#theme-toggle');
    button.innerHTML = dark ? sun : moon;
    button.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
    document.querySelector('meta[name="theme-color"]').content = dark ? '#0a1023' : '#f5f3ff';
  }
  function updateScroll() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    document.querySelector('#reading-progress').style.width = route.page === 'post' && scrollable > 0 ? `${Math.min(100, Math.max(0, window.scrollY / scrollable * 100))}%` : '0';
    document.querySelector('#back-top').hidden = window.scrollY < 650;
  }
  document.querySelector('#theme-toggle').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('zlog-theme', theme); } catch { /* 隐私模式下仍然允许切换主题。 */ }
    updateThemeButton();
  });
  document.querySelector('#open-search').addEventListener('click', openSearch);
  // 跳到正文使用焦点和滚动，避免把 #main 误当作文章路由。
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView({ behavior: 'instant' });
  });
  searchInput.addEventListener('input', () => search(searchInput.value));
  searchResults.addEventListener('click', event => { if (event.target.closest('a')) dialog.close(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (dialog.open) dialog.close(); else openSearch(); }
  });
  document.querySelector('#mobile-menu-toggle').addEventListener('click', () => {
    const menu = document.querySelector('#mobile-nav');
    menu.hidden = !menu.hidden;
    document.querySelector('#mobile-menu-toggle').setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.querySelector('#back-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  main.addEventListener('click', async event => {
    const category = event.target.closest('[data-category]');
    if (category) {
      const nextHash = category.dataset.category === '全部' ? '#/articles' : `#/category/${encodeURIComponent(category.dataset.category)}`;
      if (location.hash === nextHash) document.querySelector('#journal')?.scrollIntoView(); else location.hash = nextHash;
    }
    const section = event.target.closest('[data-section]');
    if (section) { event.preventDefault(); document.getElementById(section.dataset.section)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
    if (event.target.closest('#copy-link')) {
      try { await navigator.clipboard.writeText(location.href); toast('文章链接已复制'); }
      catch { toast('暂时无法复制，请复制浏览器地址栏中的链接'); }
    }
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateThemeButton();
  render();
})();

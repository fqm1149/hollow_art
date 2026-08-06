/**
 * Hollow Art v0.8.0
 * 整改版：IntersectionObserver + 微交互 + 状态隔离 + 骨架屏
 */
(function() {
  'use strict';

  const API = () => new Promise(r => {
    if (window.TreeholeAPI) r(); else setTimeout(() => API().then(r), 80);
  });

  let curPage = 1, loading = false;
  let curTab = 'latest';
  let searchMode = false, searchQuery = '';
  let view = localStorage.getItem('ha-v') || 'masonry';
  let cols = parseInt(localStorage.getItem('ha-cols') || '3');
  let accent = localStorage.getItem('ha-accent') || '#4CAF50';
  let dark = localStorage.getItem('ha-dark') === '1';

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // ===== IntersectionObserver (任务1) =====
  let feedObserver = null;

  async function init() {
    await API();
    applyTheme();
    document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`);
    document.body.insertAdjacentHTML('beforeend', buildHTML());
    bindEvents();
    initFeedObserver();
    loadTabPosts(1);
  }

  function applyTheme() {
    document.documentElement.style.setProperty('--ha-accent', accent);
    document.documentElement.classList.toggle('ha-dark', dark);
  }

  // ===== 任务1: IntersectionObserver 替代 setTimeout =====
  function initFeedObserver() {
    feedObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading) loadMore();
    }, { rootMargin: '0px 0px 200px 0px' });

    // 鼠标滚轮映射水平滚动（仅首页瀑布流模式）
    document.addEventListener('wheel', e => {
      if (view !== 'masonry') return;
      // 只在首页 feed 区域生效，不在详情页生效
      if (document.getElementById('ha-detail')) return;
      const feed = $('#ha-feed');
      if (!feed || feed.scrollWidth <= feed.clientWidth) return;
      e.preventDefault();
      feed.scrollLeft += e.deltaY;
    }, { passive: false });
  }

  function observeSentinel() {
    feedObserver?.disconnect();
    const sentinel = $('#ha-sentinel');
    if (sentinel) feedObserver?.observe(sentinel);
  }

  function bindEvents() {
    // Tab
    document.addEventListener('click', e => {
      const tab = e.target.closest('.ha-tab');
      if (tab) {
        $$('.ha-tab').forEach(x => x.classList.remove('ha-on'));
        tab.classList.add('ha-on');
        curTab = tab.dataset.tab;
        curPage = 1;
        loadTabPosts(1);
      }
    });

    // 视图
    $('#ha-view-btn').onclick = () => {
      view = view === 'masonry' ? 'single' : 'masonry';
      localStorage.setItem('ha-v', view);
      $('#ha-view-icon').textContent = view === 'masonry' ? '▦' : '▤';
      updateFeedClass();
    };

    // 栏数
    $('#ha-cols').oninput = e => {
      cols = parseInt(e.target.value);
      localStorage.setItem('ha-cols', cols);
      $('#ha-cols-val').textContent = cols;
      updateFeedClass();
    };

    // 主题色
    $('#ha-accent').oninput = e => {
      accent = e.target.value;
      localStorage.setItem('ha-accent', accent);
      applyTheme();
    };

    // 暗色
    $('#ha-dark-btn').onclick = () => {
      dark = !dark;
      localStorage.setItem('ha-dark', dark ? '1' : '0');
      applyTheme();
      $('#ha-dark-btn').textContent = dark ? '☀' : '🌙';
    };

    // 搜索
    const si = $('#ha-search');
    const doSearch = () => {
      const q = si.value.trim();
      if (!q) { goHome(); return; }
      searchPosts(q);
    };
    si.onkeydown = e => { if (e.key === 'Enter') doSearch(); };
    $('#ha-search-btn').onclick = doSearch;
  }

  function updateFeedClass() {
    const feed = $('#ha-feed');
    if (!feed) return;
    feed.className = view === 'masonry' ? 'ha-feed ha-masonry' : 'ha-feed';
    feed.style.setProperty('--ha-cols', cols);
  }

  function goHome() {
    $('#ha-search').value = '';
    $$('.ha-tab').forEach(x => x.classList.remove('ha-on'));
    $('.ha-tab').classList.add('ha-on');
    curTab = 'latest';
    searchMode = false;
    searchQuery = '';
    curPage = 1;
    loadTabPosts(1);
  }

  // ===== Tab 路由 =====
  async function loadTabPosts(page) {
    if (searchMode) return loadSearchResults(page);
    if (curTab === 'followed') return loadFollowed(page);
    if (curTab === 'bounty') return loadBounty(page);
    return loadPosts(page);
  }

  async function loadSearchResults(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (!c) { loading = false; return; }
    if (page === 1) { c.style.opacity = '0'; c.innerHTML = skeleton(); }
    try {
      const { posts, hasMore } = await TreeholeAPI.search(searchQuery, page, 20);
      if (page === 1) c.innerHTML = '';
      if (posts.length === 0 && page === 1) {
        c.innerHTML = '<div class="ha-msg">无结果</div>';
      } else {
        renderFeed(posts);
        curPage = page;
        insertSentinel(c, hasMore);
      }
      c.style.opacity = '1';
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; c.style.opacity = '1'; }
    loading = false;
  }

  // ===== 任务3: 入场动画 + 任务5: 骨架屏 =====
  function skeleton(n = 6) {
    return Array(n).fill('<div class="ha-skeleton"><div class="sk-line"></div><div class="sk-line sk-short"></div><div class="sk-line sk-tiny"></div></div>').join('');
  }

  async function loadPosts(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (!c) { loading = false; return; }
    if (page === 1) { c.style.opacity = '0'; c.innerHTML = skeleton(); }
    try {
      const { posts, hasMore } = await TreeholeAPI.getPosts(page, 15);
      if (page === 1) c.innerHTML = '';
      renderFeed(posts);
      curPage = page;
      insertSentinel(c, hasMore);
      c.style.opacity = '1';
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; c.style.opacity = '1'; }
    loading = false;
  }

  async function loadFollowed(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (!c) { loading = false; return; }
    if (page === 1) { c.style.opacity = '0'; c.innerHTML = skeleton(); }
    try {
      const { posts, hasMore } = await TreeholeAPI.getFollowed(page, 15);
      if (page === 1) c.innerHTML = '';
      if (posts.length === 0 && page === 1) {
        c.innerHTML = '<div class="ha-msg">还没有关注的帖子</div>';
      } else {
        renderFeed(posts);
        curPage = page;
        insertSentinel(c, hasMore);
      }
      c.style.opacity = '1';
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; c.style.opacity = '1'; }
    loading = false;
  }

  async function loadBounty(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (!c) { loading = false; return; }
    if (page === 1) { c.style.opacity = '0'; c.innerHTML = skeleton(); }
    try {
      const { posts, hasMore } = await TreeholeAPI.getBounty(page, 15);
      if (page === 1) c.innerHTML = '';
      if (posts.length === 0 && page === 1) {
        c.innerHTML = '<div class="ha-msg">暂无悬赏帖子</div>';
      } else {
        renderFeed(posts);
        curPage = page;
        insertSentinel(c, hasMore);
      }
      c.style.opacity = '1';
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; c.style.opacity = '1'; }
    loading = false;
  }

  function insertSentinel(container, hasMore) {
    container.querySelectorAll('#ha-sentinel').forEach(el => el.remove());
    if (hasMore) {
      container.insertAdjacentHTML('beforeend', '<div id="ha-sentinel"></div>');
      observeSentinel();
    }
  }

  async function loadMore() {
    $('#ha-sentinel')?.remove();
    await loadTabPosts(curPage + 1);
  }

  async function searchPosts(q) {
    searchMode = true;
    searchQuery = q;
    curPage = 1;
    await loadSearchResults(1);
  }

  // ===== 任务3: Stagger 入场动画 =====
  function renderFeed(posts) {
    const c = $('#ha-feed');
    const frag = document.createDocumentFragment();
    posts.forEach((post, i) => {
      const el = document.createElement('div');
      el.className = 'ha-card';
      el.dataset.pid = post.pid;
      el.style.animationDelay = `${i * 30}ms`;
      const imgs = post.images.length > 0
        ? `<div class="ha-imgs" data-ids='${JSON.stringify(post.images.map(im=>im.id))}'></div>` : '';
      el.innerHTML = `
        <div class="ha-card-hd">
          <span class="ha-pid">#${post.pid}</span>
          <span class="ha-tm">${post.time}</span>
          ${post.is_top ? '<span class="ha-tag ha-top">置顶</span>' : ''}
          ${post.tags.map(t => `<span class="ha-tag">${esc(t)}</span>`).join('')}
        </div>
        <div class="ha-card-bd">${esc(post.content)}</div>
        ${imgs}
        <div class="ha-card-ft">
          <span>💬 ${post.comment_num}</span>
          <span>⭐ ${post.like_num}</span>
        </div>`;
      el.onclick = e => { if (!e.target.closest('.ha-img')) openDetail(post); };
      frag.appendChild(el);
    });
    c.appendChild(frag);
    loadFeedImgs();
  }

  // ===== 任务5: 图片懒加载 =====
  let imgObserver = null;
  function initImgObserver() {
    if (imgObserver) return;
    imgObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadSingleImg(entry.target);
          imgObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '200px' });
  }

  async function loadSingleImg(el) {
    if (el.dataset.d) return;
    el.dataset.d = '1';
    try {
      const ids = JSON.parse(el.dataset.ids);
      const urls = await Promise.all(ids.slice(0, 3).map(id => TreeholeAPI.getImage(id)));
      urls.forEach(url => {
        const img = document.createElement('img');
        img.src = url; img.className = 'ha-img'; img.loading = 'lazy';
        img.onclick = e => { e.stopPropagation(); lightbox(url); };
        el.appendChild(img);
      });
    } catch (e) {}
  }

  function loadFeedImgs() {
    initImgObserver();
    document.querySelectorAll('.ha-imgs:not([data-d])').forEach(el => {
      imgObserver.observe(el);
    });
  }

  // ===== 灯箱 =====
  function lightbox(url) {
    const lb = document.createElement('div');
    lb.className = 'ha-lb';
    lb.innerHTML = `<div class="ha-lb-x">✕</div><img src="${url}">`;
    lb.onclick = () => { lb.classList.remove('on'); setTimeout(() => lb.remove(), 200); };
    document.body.appendChild(lb);
    requestAnimationFrame(() => lb.classList.add('on'));
  }

  // ===== 任务2: 状态隔离 —— 详情页使用 localCmtCols =====
  async function openDetail(post) {
    const detail = document.createElement('div');
    detail.id = 'ha-detail';
    let localCmtCols = parseInt(localStorage.getItem('ha-cmt-cols') || '2');
    // 任务: 用户颜色映射（每个详情页独立）
    const userColorMap = {};
    const palette = ['#4CAF50','#2196F3','#FF9800','#9C27B0','#E91E63','#00BCD4','#795548','#607D8B','#F44336','#3F51B5'];
    function userColor(name) {
      if (userColorMap[name]) return userColorMap[name];
      let h = 0;
      for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
      userColorMap[name] = palette[Math.abs(h) % palette.length];
      return userColorMap[name];
    }
    detail.innerHTML = detailHTML(post, localCmtCols);
    detail.style.opacity = '0';
    document.body.appendChild(detail);
    requestAnimationFrame(() => { detail.style.opacity = '1'; });

    detail.querySelector('.ha-back').onclick = () => {
      detail.style.opacity = '0';
      setTimeout(() => detail.remove(), 250);
    };

    // 图片
    if (post.images?.length > 0) {
      const ic = detail.querySelector('#ha-d-imgs');
      const urls = await Promise.all(post.images.map(i => TreeholeAPI.getImage(i.id)));
      urls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.onclick = () => lightbox(url);
        ic.appendChild(img);
      });
    }

    // 全屏
    detail.querySelector('.ha-d-fs-btn').onclick = () => {
      const box = detail.querySelector('.ha-d-content');
      if (box.requestFullscreen) box.requestFullscreen();
    };

    // 任务2: 评论栏数 — 局部作用域
    const cmtColsSlider = detail.querySelector('#ha-cmt-cols');
    const cmtGrid = detail.querySelector('#ha-d-cmts');
    if (cmtColsSlider) {
      cmtColsSlider.value = localCmtCols;
      detail.querySelector('#ha-cmt-cols-val').textContent = localCmtCols;
      cmtGrid.style.setProperty('--ha-cmt-cols', localCmtCols);
      cmtColsSlider.oninput = e => {
        localCmtCols = parseInt(e.target.value);
        localStorage.setItem('ha-cmt-cols', localCmtCols);
        detail.querySelector('#ha-cmt-cols-val').textContent = localCmtCols;
        cmtGrid.style.setProperty('--ha-cmt-cols', localCmtCols);
      };
    }

    // 任务5: 评论加载 — 骨架屏 + 滚动锁
    let cmtPage = 1, cmtLoading = false, cmtHasMore = true;
    const cmtScroll = detail.querySelector('.ha-d-right');
    const cmtLoadEl = detail.querySelector('.ha-cmt-load');

    async function loadCmts(page) {
      if (cmtLoading || !cmtHasMore) return;
      cmtLoading = true;
      if (cmtLoadEl) cmtLoadEl.textContent = '加载中...';
      // 任务5: 插入骨架屏
      if (page === 1) {
        cmtGrid.innerHTML = `<div class="ha-skeleton"><div class="sk-line"></div></div><div class="ha-skeleton"><div class="sk-line"></div></div><div class="ha-skeleton"><div class="sk-line"></div></div>`;
      }
      try {
        const { comments, hasMore } = await TreeholeAPI.getComments(post.pid, page, 15);
        cmtHasMore = hasMore;
        if (page === 1) cmtGrid.innerHTML = '';
        comments.forEach(cm => {
          // 用户颜色（同一用户同一颜色）
          const color = userColor(cm.name_tag || '匿名');
          cmtGrid.insertAdjacentHTML('beforeend', `
            <div class="ha-cmt${cm.is_lz ? ' ha-cmt-lz' : ''}">
              <div class="ha-cmt-hd">
                <span class="ha-cmt-id">#${cm.id}</span>
                <span class="ha-cmt-user" style="color:${color}">${esc(cm.name_tag || '匿名')}</span>
                <span class="ha-cmt-tm">${cm.time}</span>
                ${cm.is_lz ? '<span class="ha-tag">楼主</span>' : ''}
              </div>
              ${cm.reply_to ? `<div class="ha-cmt-reply">↩ 回复 <a href="#cmt-${cm.reply_to}">#${cm.reply_to}</a></div>` : ''}
              <div class="ha-cmt-bd">${esc(cm.content)}</div>
            </div>`);
        });
        if (cmtLoadEl) cmtLoadEl.textContent = hasMore ? '滚动加载更多' : '没有更多了';
      } catch (e) {
        if (page === 1) cmtGrid.innerHTML = '<div class="ha-msg ha-err">评论加载失败</div>';
        if (cmtLoadEl) cmtLoadEl.textContent = '加载失败';
      }
      cmtLoading = false;
    }

    loadCmts(1);

    // 任务5: 滚动锁优化
    cmtScroll.addEventListener('scroll', () => {
      if (cmtLoading || !cmtHasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = cmtScroll;
      if (scrollHeight - scrollTop - clientHeight < 10) {
        cmtPage++;
        loadCmts(cmtPage);
      }
    });
  }

  function detailHTML(post, localCmtCols) {
    return `
    <header id="ha-header">
      <div class="ha-back">←</div>
      <h1>#${post.pid}</h1>
      <span class="ha-detail-tm">${post.time}</span>
    </header>
    <div class="ha-d-layout">
      <div class="ha-d-left">
        <div class="ha-d-top-bar">
          <button class="ha-d-fs-btn" title="全屏">⛶</button>
          <div class="ha-tool" title="评论栏数"><input type="range" id="ha-cmt-cols" min="1" max="4" value="${localCmtCols}"><span id="ha-cmt-cols-val">${localCmtCols}</span></div>
        </div>
        <div class="ha-d-content">
          <div class="ha-d-text">${esc(post.content)}</div>
          <div class="ha-d-imgs" id="ha-d-imgs"></div>
        </div>
        <div class="ha-d-meta">
          <div class="ha-d-meta-row"><span>发布时间</span><span>${post.timestamp ? new Date(post.timestamp).toLocaleString('zh-CN') : post.time}</span></div>
          <div class="ha-d-meta-row"><span>💬 评论</span><span>${post.comment_num}</span></div>
          <div class="ha-d-meta-row"><span>⭐ 收藏</span><span>${post.like_num}</span></div>
          <div class="ha-d-meta-row"><span>PID</span><span>${post.pid}</span></div>
        </div>
      </div>
      <div class="ha-d-right">
        <div class="ha-d-r-hd">💬 评论 (${post.comment_num})</div>
        <div class="ha-cmt-grid" id="ha-d-cmts" style="--ha-cmt-cols:${localCmtCols}"></div>
        <div class="ha-cmt-load">加载中...</div>
      </div>
    </div>`;
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function buildHTML() {
    return `
    <div id="ha-root">
      <header id="ha-header">
        <h1>🌳 Hollow Art</h1>
        <nav>
          <button class="ha-tab ha-on" data-tab="latest">最新</button>
          <button class="ha-tab" data-tab="followed">关注</button>
          <button class="ha-tab" data-tab="bounty">悬赏</button>
        </nav>
        <button id="ha-view-btn" title="切换视图"><span id="ha-view-icon">${view === 'masonry' ? '▦' : '▤'}</span></button>
        <div class="ha-tool" title="栏数 (${cols})"><input type="range" id="ha-cols" min="1" max="5" value="${cols}"><span id="ha-cols-val">${cols}</span></div>
        <div class="ha-tool" title="主题色"><input type="color" id="ha-accent" value="${accent}"></div>
        <button id="ha-dark-btn" title="深色模式">${dark ? '☀' : '🌙'}</button>
        <div class="ha-srch">
          <input id="ha-search" type="text" placeholder="搜索… (Enter)">
          <button id="ha-search-btn">搜索</button>
        </div>
      </header>
      <main id="ha-feed" class="ha-feed ${view === 'masonry' ? 'ha-masonry' : ''}" style="--ha-cols:${cols};transition:opacity .2s"></main>
    </div>`;
  }

  // ===== CSS (含任务3/4/5) =====
  const CSS = `
    :root{--ha-accent:#4CAF50;--ha-bg:#f5f5f5;--ha-card:#fff;--ha-text:#333;--ha-sub:#666;--ha-muted:#999;--ha-border:#e0e0e0;--ha-hover:0 4px 16px rgba(0,0,0,.1);--ha-cols:3}
    .ha-dark{--ha-bg:#1a1a2e;--ha-card:#16213e;--ha-text:#e0e0e0;--ha-sub:#aaa;--ha-muted:#777;--ha-border:#333;--ha-hover:0 4px 16px rgba(0,0,0,.3)}
    *{margin:0;padding:0;box-sizing:border-box}
    #ha-root{position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;flex-direction:column;background:var(--ha-bg);z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;-webkit-font-smoothing:antialiased;color:var(--ha-text)}
    .app-wrapper{display:none!important}

    #ha-header{flex-shrink:0;background:var(--ha-card);padding:10px 20px;border-bottom:1px solid var(--ha-border);display:flex;align-items:center;gap:12px;z-index:100}
    #ha-header h1{font-size:18px;margin:0;color:var(--ha-text);white-space:nowrap}
    nav{display:flex;gap:4px}
    .ha-tab{padding:5px 14px;border:1px solid var(--ha-border);border-radius:14px;background:var(--ha-card);cursor:pointer;font-size:13px;color:var(--ha-sub);transition:all .12s}
    .ha-tab:hover{border-color:var(--ha-accent);color:var(--ha-accent)}
    .ha-tab.ha-on{background:var(--ha-accent);color:#fff;border-color:var(--ha-accent)}
    #ha-view-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:6px;cursor:pointer;font-size:17px;color:var(--ha-sub);background:var(--ha-card)}
    .ha-tool{display:flex;align-items:center;gap:4px}
    .ha-tool input[type=range]{width:60px;accent-color:var(--ha-accent)}
    .ha-tool input[type=color]{width:24px;height:24px;border:none;border-radius:4px;cursor:pointer;padding:0}
    #ha-dark-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:6px;cursor:pointer;font-size:16px;background:var(--ha-card)}
    .ha-srch{margin-left:auto;display:flex;gap:5px}
    .ha-srch input{padding:5px 12px;border:1px solid var(--ha-border);border-radius:14px;width:170px;font-size:13px;outline:none;background:var(--ha-card);color:var(--ha-text)}
    .ha-srch input:focus{border-color:var(--ha-accent)}
    .ha-srch button{padding:5px 14px;background:var(--ha-accent);color:#fff;border:none;border-radius:14px;cursor:pointer;font-size:13px}

    .ha-feed{flex:1;overflow-y:auto;padding:16px 20px}
    .ha-masonry{columns:var(--ha-cols,3);column-gap:12px}
    .ha-masonry .ha-card{break-inside:avoid}

    /* 任务3: 入场动画 + 任务4: 阴影升级 + 点击触感 */
    @keyframes haFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .ha-card{background:var(--ha-card);border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.04);border:1px solid transparent;cursor:pointer;transition:transform .12s,box-shadow .2s,border-color .2s;animation:haFadeUp .25s ease-out forwards;opacity:0}
    .ha-card:hover{box-shadow:0 8px 25px rgba(0,0,0,.08);border-color:var(--ha-border)}
    .ha-card:active{transform:scale(0.98)}

    .ha-card-hd{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap}
    .ha-pid{font-weight:700;color:var(--ha-accent);font-size:14px}
    .ha-tm{color:var(--ha-muted);font-size:12px}
    .ha-tag{padding:2px 7px;background:color-mix(in srgb, var(--ha-accent) 12%, transparent);color:var(--ha-accent);border-radius:6px;font-size:11px}
    .ha-tag.ha-top{background:#fff3e0;color:#ff9800}
    .ha-card-bd{font-size:15px;line-height:1.65;color:var(--ha-text);white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
    .ha-imgs{display:flex;gap:5px;margin-top:10px;flex-wrap:wrap}
    .ha-img{width:110px;height:110px;border-radius:6px;object-fit:cover;background:var(--ha-bg);cursor:pointer}
    .ha-card-ft{display:flex;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--ha-border);color:var(--ha-sub);font-size:13px}
    .ha-msg{text-align:center;padding:40px;color:var(--ha-muted);font-size:14px}
    .ha-err{color:#f44336}

    /* 任务5: 骨架屏 */
    .ha-skeleton{background:var(--ha-card);border-radius:10px;padding:16px;margin-bottom:12px;animation:sk-pulse 1.5s ease-in-out infinite}
    .sk-line{height:14px;background:var(--ha-border);border-radius:4px;margin-bottom:8px;width:100%}
    .sk-short{width:60%}
    .sk-tiny{width:30%}
    @keyframes sk-pulse{0%,100%{opacity:1}50%{opacity:.4}}

    .ha-lb{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.92);z-index:99999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
    .ha-lb.on{opacity:1}
    .ha-lb img{max-width:92vw;max-height:92vh;object-fit:contain;border-radius:4px}
    .ha-lb-x{position:absolute;top:16px;right:24px;color:#fff;font-size:28px;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.15)}

    #ha-detail{position:fixed;top:0;left:0;width:100vw;height:100vh;background:var(--ha-bg);z-index:9999998;display:flex;flex-direction:column;transition:opacity .25s}
    .ha-back{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;font-size:18px;color:var(--ha-sub)}
    .ha-back:hover{background:var(--ha-bg)}
    .ha-detail-tm{color:var(--ha-muted);font-size:13px;margin-left:auto}
    .ha-d-layout{flex:1;display:flex;overflow:hidden}
    .ha-d-left{flex:0 0 44%;max-width:44%;overflow-y:auto;padding:20px 24px;border-right:1px solid var(--ha-border);background:var(--ha-card)}
    .ha-d-right{flex:1;overflow-y:auto;padding:20px 24px;background:var(--ha-bg)}
    .ha-d-top-bar{display:flex;align-items:center;gap:10px;margin-bottom:14px}
    .ha-d-fs-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:6px;background:var(--ha-card);cursor:pointer;font-size:15px;color:var(--ha-sub)}
    .ha-d-fs-btn:hover{background:var(--ha-bg);color:var(--ha-text)}
    .ha-d-content{background:var(--ha-card);border-radius:10px;border:1px solid var(--ha-border);padding:20px}
    .ha-d-text{font-size:16px;line-height:1.8;color:var(--ha-text);white-space:pre-wrap;word-break:break-word}
    .ha-d-imgs{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .ha-d-imgs img{max-width:220px;max-height:220px;border-radius:8px;cursor:pointer;object-fit:cover}
    .ha-d-meta{margin-top:16px;background:var(--ha-bg);border-radius:8px;padding:14px 16px}
    .ha-d-meta-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;color:var(--ha-sub);border-bottom:1px solid var(--ha-border)}
    .ha-d-meta-row:last-child{border-bottom:none}
    .ha-d-r-hd{font-size:16px;font-weight:600;color:var(--ha-text);padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid var(--ha-border)}
    .ha-cmt-grid{display:grid;grid-template-columns:repeat(var(--ha-cmt-cols,2),1fr);gap:10px}
    .ha-cmt{background:var(--ha-card);border-radius:8px;padding:12px 14px;box-shadow:0 1px 3px rgba(0,0,0,.04);border-left:3px solid var(--ha-border)}
    .ha-cmt-lz{border-left-color:var(--ha-accent)}
    .ha-cmt-hd{display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap}
    .ha-cmt-id{font-weight:700;color:var(--ha-muted);font-size:11px;font-family:monospace}
    .ha-cmt-user{font-weight:600;font-size:13px}
    .ha-cmt-tm{color:var(--ha-muted);font-size:11px}
    .ha-cmt-reply{font-size:11px;color:var(--ha-muted);margin-bottom:4px}
    .ha-cmt-reply a{color:var(--ha-accent);text-decoration:none}
    .ha-cmt-bd{font-size:14px;color:var(--ha-text);line-height:1.55}
    .ha-cmt-load{text-align:center;padding:18px;color:var(--ha-muted);font-size:13px}

    @media(max-width:900px){.ha-d-layout{flex-direction:column}.ha-d-left{flex:none;max-width:100%;border-right:none;border-bottom:1px solid var(--ha-border)}.ha-cmt-grid{grid-template-columns:1fr!important}}
    @media(max-width:600px){.ha-masonry{columns:1!important}.ha-d-left,.ha-d-right{padding:16px}}
  `;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

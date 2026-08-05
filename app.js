/**
 * Hollow Art v0.6.0
 * 字体优化 + 暗色模式 + 栏数调节 + 主题色
 */
(function() {
  'use strict';

  const API = () => new Promise(r => {
    if (window.TreeholeAPI) r(); else setTimeout(() => API().then(r), 80);
  });

  let curPage = 1, loading = false;
  let view = localStorage.getItem('ha-v') || 'masonry';
  let cols = parseInt(localStorage.getItem('ha-cols') || '3');
  let cmtCols = parseInt(localStorage.getItem('ha-cmt-cols') || '2');
  let accent = localStorage.getItem('ha-accent') || '#4CAF50';
  let dark = localStorage.getItem('ha-dark') === '1';

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  async function init() {
    await API();
    applyTheme();
    document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`);
    document.body.insertAdjacentHTML('beforeend', buildHTML());
    bindEvents();
    loadPosts(1);
  }

  // ===== 主题 =====
  function applyTheme() {
    document.documentElement.style.setProperty('--ha-accent', accent);
    document.documentElement.classList.toggle('ha-dark', dark);
  }

  // ===== 事件 =====
  function bindEvents() {
    // Tab 切换
    document.addEventListener('click', e => {
      const tab = e.target.closest('.ha-tab');
      if (tab) {
        $$('.ha-tab').forEach(x => x.classList.remove('ha-on'));
        tab.classList.add('ha-on');
        curPage = 1; loadPosts(1);
      }
    });

    // 视图切换
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
      updateFeedClass();
    };

    // 主题色
    $('#ha-accent').oninput = e => {
      accent = e.target.value;
      localStorage.setItem('ha-accent', accent);
      applyTheme();
    };

    // 暗色模式
    $('#ha-dark-btn').onclick = () => {
      dark = !dark;
      localStorage.setItem('ha-dark', dark ? '1' : '0');
      applyTheme();
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

    // 无限滚动 — 挂在 #ha-feed 上
    setTimeout(() => {
      const feed = $('#ha-feed');
      if (feed) {
        feed.onscroll = () => {
          if (loading) return;
          if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 400) loadMore();
        };
        // 鼠标滚轮映射水平滚动（瀑布流模式）
        feed.addEventListener('wheel', e => {
          if (view !== 'masonry') return;
          // 如果内容没有水平溢出，不做映射
          if (feed.scrollWidth <= feed.clientWidth) return;
          e.preventDefault();
          feed.scrollLeft += e.deltaY;
        }, { passive: false });
      }
    }, 100);

    // 开屏自动加载更多（加载3页）
    setTimeout(async () => {
      for (let i = 0; i < 2; i++) {
        await loadPosts(curPage + 1);
        await new Promise(r => setTimeout(r, 300));
      }
    }, 1000);
  }

  function updateFeedClass() {
    const feed = $('#ha-feed');
    if (!feed) return;
    feed.className = 'ha-feed';
    if (view === 'masonry') {
      feed.classList.add('ha-masonry');
      feed.style.setProperty('--ha-cols', cols);
    }
  }

  function goHome() {
    $('#ha-search').value = '';
    $$('.ha-tab').forEach(x => x.classList.remove('ha-on'));
    $('.ha-tab').classList.add('ha-on');
    curPage = 1; loadPosts(1);
  }

  // ===== 加载 =====
  async function loadPosts(page) {
    if (loading) return; loading = true;
    const c = $('#ha-feed');
    if (!c) { loading = false; return; }
    if (page === 1) c.innerHTML = '<div class="ha-msg">加载中...</div>';
    try {
      const { posts, hasMore } = await TreeholeAPI.getPosts(page, 15);
      if (page === 1) c.innerHTML = '';
      renderFeed(posts);
      curPage = page;
      if (hasMore) c.insertAdjacentHTML('beforeend', '<div class="ha-more">加载更多</div>');
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; }
    loading = false;
  }

  async function loadMore() {
    $('.ha-more')?.remove();
    await loadPosts(curPage + 1);
  }

  async function searchPosts(q) {
    const c = $('#ha-feed');
    c.innerHTML = '<div class="ha-msg">搜索中...</div>';
    try {
      const { posts } = await TreeholeAPI.search(q, 1, 30);
      c.innerHTML = '';
      posts.length ? renderFeed(posts) : (c.innerHTML = '<div class="ha-msg">无结果</div>');
    } catch (e) { c.innerHTML = `<div class="ha-msg ha-err">${e.message}</div>`; }
  }

  // ===== 渲染 =====
  function renderFeed(posts) {
    const c = $('#ha-feed');
    const frag = document.createDocumentFragment();
    posts.forEach(post => {
      const el = document.createElement('div');
      el.className = 'ha-card';
      el.dataset.pid = post.pid;
      const imgs = post.images.length > 0
        ? `<div class="ha-imgs" data-ids='${JSON.stringify(post.images.map(i=>i.id))}'></div>` : '';
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
          <span>🔄 ${post.share_num}</span>
        </div>`;
      el.onclick = e => { if (!e.target.closest('.ha-img')) openDetail(post, el); };
      frag.appendChild(el);
    });
    c.appendChild(frag);
    loadFeedImgs();
  }

  async function loadFeedImgs() {
    await Promise.all(Array.from(document.querySelectorAll('.ha-imgs:not([data-d])')).map(async el => {
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
    }));
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

  // ===== 详情页（简单淡入）=====
  async function openDetail(post, sourceEl) {
    const detail = document.createElement('div');
    detail.id = 'ha-detail';
    detail.innerHTML = detailHTML(post);
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

    // 内容全屏
    detail.querySelector('.ha-d-fs-btn').onclick = () => {
      const box = detail.querySelector('.ha-d-content');
      if (box.requestFullscreen) box.requestFullscreen();
    };

    // 评论栏数
    const cmtColsSlider = detail.querySelector('#ha-cmt-cols');
    const cmtGrid = detail.querySelector('#ha-d-cmts');
    if (cmtColsSlider) {
      cmtColsSlider.value = cmtCols;
      detail.querySelector('#ha-cmt-cols-val').textContent = cmtCols;
      cmtGrid.style.setProperty('--ha-cmt-cols', cmtCols);
      cmtColsSlider.oninput = e => {
        cmtCols = parseInt(e.target.value);
        localStorage.setItem('ha-cmt-cols', cmtCols);
        detail.querySelector('#ha-cmt-cols-val').textContent = cmtCols;
        cmtGrid.style.setProperty('--ha-cmt-cols', cmtCols);
      };
    }

    // 评论
    let cmtPage = 1, cmtLoading = false, cmtHasMore = true;
    const cmtScroll = detail.querySelector('.ha-d-right');

    async function loadCmts(page) {
      if (cmtLoading || !cmtHasMore) return;
      cmtLoading = true;
      try {
        const { comments, hasMore } = await TreeholeAPI.getComments(post.pid, page, 12);
        cmtHasMore = hasMore;
        comments.forEach(cm => {
          cmtGrid.insertAdjacentHTML('beforeend', `
            <div class="ha-cmt${cm.is_lz ? ' ha-cmt-lz' : ''}">
              <div class="ha-cmt-hd">
                <span class="ha-cmt-id">#${cm.id}</span>
                <span class="ha-cmt-user">${esc(cm.name_tag || '匿名')}</span>
                <span class="ha-cmt-tm">${cm.time}</span>
                ${cm.is_lz ? '<span class="ha-tag">楼主</span>' : ''}
              </div>
              ${cm.reply_to ? `<div class="ha-cmt-reply">↩ 回复 <a href="#cmt-${cm.reply_to}">#${cm.reply_to}</a></div>` : ''}
              <div class="ha-cmt-bd">${esc(cm.content)}</div>
            </div>`);
        });
        if (!hasMore) detail.querySelector('.ha-cmt-load').textContent = '没有更多了';
      } catch (e) {
        if (page === 1) cmtGrid.innerHTML = '<div class="ha-msg ha-err">评论加载失败</div>';
      }
      cmtLoading = false;
    }
    loadCmts(1);
    cmtScroll.onscroll = () => {
      if (cmtLoading || !cmtHasMore) return;
      if (cmtScroll.scrollTop + cmtScroll.clientHeight >= cmtScroll.scrollHeight - 200) {
        cmtPage++; loadCmts(cmtPage);
      }
    };
  }

  function detailHTML(post) {
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
          <div class="ha-tool" title="评论栏数"><input type="range" id="ha-cmt-cols" min="1" max="4" value="${cmtCols}"><span id="ha-cmt-cols-val">${cmtCols}</span></div>
        </div>
        <div class="ha-d-content">
          <div class="ha-d-text">${esc(post.content)}</div>
          <div class="ha-d-imgs" id="ha-d-imgs"></div>
        </div>
        <div class="ha-d-meta">
          <div class="ha-d-meta-row"><span>发布时间</span><span>${post.timestamp ? new Date(post.timestamp).toLocaleString('zh-CN') : post.time}</span></div>
          <div class="ha-d-meta-row"><span>💬 评论</span><span>${post.comment_num}</span></div>
          <div class="ha-d-meta-row"><span>⭐ 收藏</span><span>${post.like_num}</span></div>
          <div class="ha-d-meta-row"><span>🔄 转发</span><span>${post.share_num}</span></div>
          <div class="ha-d-meta-row"><span>PID</span><span>${post.pid}</span></div>
        </div>
      </div>
      <div class="ha-d-right">
        <div class="ha-d-r-hd">💬 评论 (${post.comment_num})</div>
        <div class="ha-cmt-grid" id="ha-d-cmts"></div>
        <div class="ha-cmt-load">加载中...</div>
      </div>
    </div>`;
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // ===== HTML =====
  function buildHTML() {
    return `
    <div id="ha-root">
      <header id="ha-header">
        <h1>🌳 Hollow Art</h1>
        <nav>
          <button class="ha-tab ha-on">最新</button>
          <button class="ha-tab">关注</button>
          <button class="ha-tab">悬赏</button>
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
      <main id="ha-feed" class="ha-feed ${view === 'masonry' ? 'ha-masonry' : ''}" style="--ha-cols:${cols}"></main>
    </div>`;
  }

  // ===== CSS =====
  const CSS = `
    :root{--ha-accent:#4CAF50;--ha-bg:#f5f5f5;--ha-card:#fff;--ha-text:#333;--ha-sub:#666;--ha-muted:#999;--ha-border:#e0e0e0;--ha-hover:0 4px 16px rgba(0,0,0,.1)}
    .ha-dark{--ha-bg:#1a1a2e;--ha-card:#16213e;--ha-text:#e0e0e0;--ha-sub:#aaa;--ha-muted:#777;--ha-border:#333;--ha-hover:0 4px 16px rgba(0,0,0,.3)}
    *{margin:0;padding:0;box-sizing:border-box}
    #ha-root{position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;flex-direction:column;background:var(--ha-bg);z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;-webkit-font-smoothing:antialiased;color:var(--ha-text)}
    .app-wrapper{display:none!important}

    /* 顶栏 */
    #ha-header{flex-shrink:0;background:var(--ha-card);padding:10px 20px;border-bottom:1px solid var(--ha-border);display:flex;align-items:center;gap:12px;z-index:100}
    #ha-header h1{font-size:18px;margin:0;color:var(--ha-text);white-space:nowrap}
    nav{display:flex;gap:4px}
    .ha-tab{padding:5px 14px;border:1px solid var(--ha-border);border-radius:14px;background:var(--ha-card);cursor:pointer;font-size:13px;color:var(--ha-sub);transition:all .12s}
    .ha-tab:hover{border-color:var(--ha-accent);color:var(--ha-accent)}
    .ha-tab.ha-on{background:var(--ha-accent);color:#fff;border-color:var(--ha-accent)}
    #ha-view-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:6px;cursor:pointer;font-size:17px;color:var(--ha-sub);background:var(--ha-card);transition:all .12s}
    #ha-view-btn:hover{background:var(--ha-bg)}
    .ha-tool{display:flex;align-items:center;gap:4px}
    .ha-tool input[type=range]{width:60px;accent-color:var(--ha-accent)}
    .ha-tool input[type=color]{width:24px;height:24px;border:none;border-radius:4px;cursor:pointer;padding:0}
    #ha-dark-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ha-border);border-radius:6px;cursor:pointer;font-size:16px;background:var(--ha-card);transition:all .12s}
    #ha-dark-btn:hover{background:var(--ha-bg)}
    #ha-cols-val{font-size:11px;color:var(--ha-muted);min-width:12px}
    .ha-srch{margin-left:auto;display:flex;gap:5px}
    .ha-srch input{padding:5px 12px;border:1px solid var(--ha-border);border-radius:14px;width:170px;font-size:13px;outline:none;background:var(--ha-card);color:var(--ha-text)}
    .ha-srch input:focus{border-color:var(--ha-accent)}
    .ha-srch button{padding:5px 14px;background:var(--ha-accent);color:#fff;border:none;border-radius:14px;cursor:pointer;font-size:13px}

    /* feed */
    .ha-feed{flex:1;overflow-y:auto;padding:16px 20px}
    .ha-masonry{columns:var(--ha-cols,3);column-gap:12px}
    .ha-masonry .ha-card{break-inside:avoid}
    .ha-card{background:var(--ha-card);border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);cursor:pointer;transition:box-shadow .15s}
    .ha-card:hover{box-shadow:var(--ha-hover)}
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
    .ha-more{text-align:center;padding:14px;color:var(--ha-accent);cursor:pointer;font-size:14px}
    .ha-more:hover{text-decoration:underline}

    /* 灯箱 */
    .ha-lb{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.92);z-index:99999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
    .ha-lb.on{opacity:1}
    .ha-lb img{max-width:92vw;max-height:92vh;object-fit:contain;border-radius:4px}
    .ha-lb-x{position:absolute;top:16px;right:24px;color:#fff;font-size:28px;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.15)}
    .ha-lb-x:hover{background:rgba(255,255,255,.3)}

    /* 详情页 */
    #ha-detail{position:fixed;top:0;left:0;width:100vw;height:100vh;background:var(--ha-bg);z-index:9999998;display:flex;flex-direction:column;transition:opacity .25s}
    .ha-back{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;font-size:18px;color:var(--ha-sub);transition:background .12s}
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
    .ha-d-imgs img{max-width:220px;max-height:220px;border-radius:8px;cursor:pointer;object-fit:cover;transition:transform .12s}
    .ha-d-imgs img:hover{transform:scale(1.02)}
    .ha-d-meta{margin-top:16px;background:var(--ha-bg);border-radius:8px;padding:14px 16px}
    .ha-d-meta-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;color:var(--ha-sub);border-bottom:1px solid var(--ha-border)}
    .ha-d-meta-row:last-child{border-bottom:none}
    .ha-d-r-hd{font-size:16px;font-weight:600;color:var(--ha-text);padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid var(--ha-border)}
    .ha-cmt-grid{display:grid;grid-template-columns:repeat(var(--ha-cmt-cols,2),1fr);gap:10px}
    .ha-cmt{background:var(--ha-card);border-radius:8px;padding:12px 14px;box-shadow:0 1px 3px rgba(0,0,0,.04);border-left:3px solid var(--ha-border)}
    .ha-cmt-lz{border-left-color:var(--ha-accent)}
    .ha-cmt-hd{display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap}
    .ha-cmt-id{font-weight:700;color:var(--ha-muted);font-size:11px;font-family:monospace}
    .ha-cmt-user{font-weight:600;color:var(--ha-accent);font-size:13px}
    .ha-cmt-tm{color:var(--ha-muted);font-size:11px}
    .ha-cmt-reply{font-size:11px;color:var(--ha-muted);margin-bottom:4px}
    .ha-cmt-reply a{color:var(--ha-accent);text-decoration:none}
    .ha-cmt-reply a:hover{text-decoration:underline}
    .ha-cmt-bd{font-size:14px;color:var(--ha-text);line-height:1.55}
    .ha-cmt-load{text-align:center;padding:18px;color:var(--ha-muted);font-size:13px}

    @media(max-width:900px){.ha-d-layout{flex-direction:column}.ha-d-left{flex:none;max-width:100%;border-right:none;border-bottom:1px solid var(--ha-border)}.ha-cmt-grid{grid-template-columns:1fr!important}}
    @media(max-width:600px){.ha-masonry{columns:1!important}.ha-d-left,.ha-d-right{padding:16px}}
  `;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

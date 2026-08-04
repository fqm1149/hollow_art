/**
 * Hollow Art - 树洞重绘 v0.3.0
 * 瀑布流 + 图片灯箱 + 帖子详情页 + 评论分页
 */
(function() {
  'use strict';

  function waitForAPI() {
    return new Promise(resolve => {
      if (window.TreeholeAPI) resolve();
      else setTimeout(() => waitForAPI().then(resolve), 100);
    });
  }

  let currentPage = 1;
  let isLoading = false;
  let viewMode = localStorage.getItem('ha-view') || 'masonry'; // 'masonry' | 'single'

  async function init() {
    await waitForAPI();
    hideOriginalUI();
    injectStyles();
    createApp();
    loadPosts(1);
  }

  function hideOriginalUI() {
    const s = document.createElement('style');
    s.textContent = `.app-wrapper{display:none!important}`;
    document.head.appendChild(s);
  }

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* 灯箱 */
      .ha-lightbox{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.92);z-index:9999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s}
      .ha-lightbox.ha-show{opacity:1}
      .ha-lightbox img{max-width:90vw;max-height:90vh;object-fit:contain;border-radius:4px}
      .ha-lightbox-close{position:absolute;top:16px;right:24px;color:#fff;font-size:32px;cursor:pointer;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.15)}
      .ha-lightbox-close:hover{background:rgba(255,255,255,.3)}
      
      /* 详情页过渡 */
      .ha-detail-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;background:#f5f5f5;z-index:9999998;overflow-y:auto;transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1)}
      .ha-detail-overlay.ha-show{transform:translateX(0)}
      
      /* 瀑布流 */
      .ha-masonry{columns:3;column-gap:12px}
      .ha-masonry .ha-post{break-inside:avoid;margin-bottom:12px}
      .ha-single .ha-post{margin-bottom:12px}
      
      /* 详情页 */
      .ha-detail-header{position:sticky;top:0;background:#fff;padding:12px 20px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;z-index:5}
      .ha-detail-back{cursor:pointer;font-size:20px;color:#666;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background .15s}
      .ha-detail-back:hover{background:#f0f0f0}
      .ha-detail-title{font-size:16px;font-weight:600;color:#333}
      .ha-detail-body{max-width:760px;margin:0 auto;padding:20px}
      .ha-detail-content{background:#fff;border-radius:10px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:16px}
      .ha-detail-content .ha-post-content{font-size:15px;line-height:1.7}
      .ha-detail-images{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .ha-detail-images img{max-width:240px;max-height:240px;border-radius:6px;cursor:pointer;object-fit:cover;transition:transform .15s}
      .ha-detail-images img:hover{transform:scale(1.02)}
      .ha-detail-stats{display:flex;gap:20px;margin-top:14px;padding-top:14px;border-top:1px solid #f0f0f0;color:#888;font-size:14px}
      .ha-comments-section{background:#fff;border-radius:10px;padding:16px 20px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
      .ha-comments-title{font-size:14px;font-weight:600;color:#333;margin-bottom:12px}
      .ha-comment{padding:10px 12px;background:#fafafa;border-radius:6px;margin-bottom:8px;border-left:3px solid #e0e0e0}
      .ha-comment-meta{display:flex;align-items:center;gap:6px;margin-bottom:4px}
      .ha-comment-user{font-weight:500;color:#4CAF50;font-size:13px}
      .ha-comment-time{color:#999;font-size:11px}
      .ha-comment-content{font-size:13px;color:#444;line-height:1.5}
      .ha-comments-loading{text-align:center;padding:20px;color:#999}
      .ha-comments-more{text-align:center;padding:14px;color:#4CAF50;cursor:pointer;font-size:14px}
      .ha-comments-more:hover{text-decoration:underline}
      
      /* 响应式 */
      @media(max-width:1200px){.ha-masonry{columns:2}}
      @media(max-width:768px){.ha-masonry{columns:1}}
    `;
    document.head.appendChild(s);
  }

  function createApp() {
    const app = document.createElement('div');
    app.id = 'hollow-art';
    app.innerHTML = `
      <div class="ha-header">
        <h1>🌳 Hollow Art</h1>
        <div class="ha-nav">
          <button class="ha-btn ha-active" data-tab="latest">最新</button>
          <button class="ha-btn" data-tab="followed">关注</button>
          <button class="ha-btn" data-tab="bounty">悬赏</button>
        </div>
        <div class="ha-view-toggle" id="ha-view-toggle" title="切换视图">
          <span class="ha-vt-icon">${viewMode === 'masonry' ? '▦' : '▤'}</span>
        </div>
        <div class="ha-search">
          <input type="text" placeholder="搜索..." id="ha-search-input">
          <button id="ha-search-btn">搜索</button>
        </div>
      </div>
      <div class="ha-content ${viewMode === 'masonry' ? 'ha-masonry' : 'ha-single'}" id="ha-posts"></div>
    `;
    document.body.appendChild(app);

    // 视图切换
    document.getElementById('ha-view-toggle').addEventListener('click', () => {
      viewMode = viewMode === 'masonry' ? 'single' : 'masonry';
      localStorage.setItem('ha-view', viewMode);
      const content = document.getElementById('ha-posts');
      content.className = `ha-content ${viewMode === 'masonry' ? 'ha-masonry' : 'ha-single'}`;
      document.querySelector('.ha-vt-icon').textContent = viewMode === 'masonry' ? '▦' : '▤';
    });

    // Tab
    app.querySelectorAll('.ha-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.ha-btn').forEach(b => b.classList.remove('ha-active'));
        btn.classList.add('ha-active');
        currentPage = 1;
        loadPosts(1);
      });
    });

    // 搜索
    let timer;
    document.getElementById('ha-search-input').addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (e.target.value.trim()) searchPosts(e.target.value.trim()); }, 400);
    });
    document.getElementById('ha-search-btn').addEventListener('click', () => {
      const q = document.getElementById('ha-search-input').value.trim();
      if (q) searchPosts(q);
    });

    // 无限滚动
    window.addEventListener('scroll', () => {
      if (isLoading) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) loadMore();
    });
  }

  // ===== 加载帖子 =====
  async function loadPosts(page) {
    if (isLoading) return;
    isLoading = true;
    const c = document.getElementById('ha-posts');
    if (page === 1) c.innerHTML = '<div class="ha-loading">加载中...</div>';
    try {
      const { posts, hasMore } = await TreeholeAPI.getPosts(page, 15);
      if (page === 1) c.innerHTML = '';
      renderPosts(posts);
      currentPage = page;
      if (hasMore) c.insertAdjacentHTML('beforeend', '<div class="ha-load-more" id="ha-load-trigger"></div>');
    } catch(e) { c.innerHTML = `<div class="ha-error">${e.message}</div>`; }
    isLoading = false;
  }

  async function loadMore() {
    document.getElementById('ha-load-trigger')?.remove();
    await loadPosts(currentPage + 1);
  }

  async function searchPosts(q) {
    const c = document.getElementById('ha-posts');
    c.innerHTML = '<div class="ha-loading">搜索中...</div>';
    try {
      const { posts } = await TreeholeAPI.search(q, 1, 30);
      c.innerHTML = '';
      posts.length ? renderPosts(posts) : (c.innerHTML = '<div class="ha-loading">无结果</div>');
    } catch(e) { c.innerHTML = `<div class="ha-error">${e.message}</div>`; }
  }

  // ===== 渲染帖子 =====
  function renderPosts(posts) {
    const c = document.getElementById('ha-posts');
    const frag = document.createDocumentFragment();
    posts.forEach(post => {
      const el = document.createElement('div');
      el.className = 'ha-post';
      el.dataset.pid = post.pid;
      const imgs = post.images.length > 0
        ? `<div class="ha-post-images" data-ids='${JSON.stringify(post.images.map(i=>i.id))}'></div>` : '';
      el.innerHTML = `
        <div class="ha-post-header">
          <span class="ha-pid">#${post.pid}</span><span class="ha-time">${post.time}</span>
          ${post.is_top ? '<span class="ha-tag ha-top">置顶</span>' : ''}
          ${post.tags.map(t=>`<span class="ha-tag">${esc(t)}</span>`).join('')}
        </div>
        <div class="ha-post-content">${esc(post.content)}</div>
        ${imgs}
        <div class="ha-post-footer">
          <span class="ha-stat">💬 ${post.comment_num}</span>
          <span class="ha-stat">⭐ ${post.like_num}</span>
          <span class="ha-stat">🔄 ${post.share_num}</span>
        </div>`;
      el.addEventListener('click', (e) => {
        if (e.target.closest('.ha-image')) return;
        openDetail(post);
      });
      frag.appendChild(el);
    });
    c.appendChild(frag);
    loadAllImages();
  }

  async function loadAllImages() {
    const phs = document.querySelectorAll('.ha-post-images:not([data-done])');
    await Promise.all(Array.from(phs).map(async el => {
      el.dataset.done = '1';
      try {
        const ids = JSON.parse(el.dataset.ids);
        const urls = await Promise.all(ids.slice(0, 3).map(id => TreeholeAPI.getImage(id)));
        urls.forEach(url => {
          const img = document.createElement('img');
          img.src = url; img.className = 'ha-image'; img.loading = 'lazy';
          img.addEventListener('click', (e) => { e.stopPropagation(); openLightbox(url); });
          el.appendChild(img);
        });
      } catch(e) {}
    }));
  }

  // ===== 灯箱 =====
  function openLightbox(url) {
    const lb = document.createElement('div');
    lb.className = 'ha-lightbox';
    lb.innerHTML = `<div class="ha-lightbox-close">✕</div><img src="${url}">`;
    lb.addEventListener('click', () => { lb.classList.remove('ha-show'); setTimeout(() => lb.remove(), 250); });
    document.body.appendChild(lb);
    requestAnimationFrame(() => lb.classList.add('ha-show'));
  }

  // ===== 帖子详情页 =====
  async function openDetail(post) {
    const overlay = document.createElement('div');
    overlay.className = 'ha-detail-overlay';
    overlay.innerHTML = `
      <div class="ha-detail-header">
        <div class="ha-detail-back">←</div>
        <div class="ha-detail-title">#${post.pid}</div>
      </div>
      <div class="ha-detail-body">
        <div class="ha-detail-content" id="ha-detail-main">
          <div class="ha-post-header">
            <span class="ha-pid">#${post.pid}</span><span class="ha-time">${post.time}</span>
            ${post.tags.map(t=>`<span class="ha-tag">${esc(t)}</span>`).join('')}
          </div>
          <div class="ha-post-content">${esc(post.content)}</div>
          <div class="ha-detail-images" id="ha-detail-imgs"></div>
          <div class="ha-detail-stats">
            <span>💬 ${post.comment_num}</span><span>⭐ ${post.like_num}</span><span>🔄 ${post.share_num}</span>
          </div>
        </div>
        <div class="ha-comments-section">
          <div class="ha-comments-title">评论 (${post.comment_num})</div>
          <div id="ha-detail-comments"><div class="ha-comments-loading">加载中...</div></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.ha-detail-back').addEventListener('click', () => closeDetail(overlay));
    requestAnimationFrame(() => overlay.classList.add('ha-show'));

    // 加载详情图
    if (post.images?.length > 0) {
      const imgC = overlay.querySelector('#ha-detail-imgs');
      const urls = await Promise.all(post.images.map(i => TreeholeAPI.getImage(i.id)));
      urls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.addEventListener('click', () => openLightbox(url));
        imgC.appendChild(img);
      });
    }

    // 加载评论（分页）
    loadDetailComments(overlay, post.pid, 1);
  }

  async function loadDetailComments(overlay, pid, page) {
    const c = overlay.querySelector('#ha-detail-comments');
    try {
      const { comments, hasMore } = await TreeholeAPI.getComments(pid, page, 15);
      if (page === 1) c.innerHTML = '';
      comments.forEach(cm => {
        c.insertAdjacentHTML('beforeend', `
          <div class="ha-comment">
            <div class="ha-comment-meta">
              <span class="ha-comment-user">${esc(cm.name_tag || '匿名')}</span>
              <span class="ha-comment-time">${cm.time}</span>
              ${cm.is_lz ? '<span class="ha-tag" style="background:#e3f2fd;color:#1976d2">楼主</span>' : ''}
            </div>
            <div class="ha-comment-content">${esc(cm.content)}</div>
          </div>`);
      });
      if (hasMore) {
        c.insertAdjacentHTML('beforeend', `<div class="ha-comments-more" data-page="${page+1}">加载更多</div>`);
        c.querySelector('.ha-comments-more').addEventListener('click', function() {
          this.remove();
          loadDetailComments(overlay, pid, parseInt(this.dataset.page));
        });
      }
    } catch(e) {
      if (page === 1) c.innerHTML = '<div class="ha-comments-loading">评论加载失败</div>';
    }
  }

  function closeDetail(overlay) {
    overlay.classList.remove('ha-show');
    setTimeout(() => overlay.remove(), 300);
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

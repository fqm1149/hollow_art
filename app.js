/**
 * Hollow Art - 树洞重绘 v0.2.0
 * 优化异步加载性能
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

  async function init() {
    await waitForAPI();
    console.log('[Hollow Art] v0.2.0 ready');
    hideOriginalUI();
    createApp();
    loadPosts(1);
  }

  function hideOriginalUI() {
    const style = document.createElement('style');
    style.textContent = `.app-wrapper { display: none !important; }`;
    document.head.appendChild(style);
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
        <div class="ha-search">
          <input type="text" placeholder="搜索帖子..." id="ha-search-input">
          <button id="ha-search-btn">搜索</button>
        </div>
      </div>
      <div class="ha-content" id="ha-posts"></div>
    `;
    document.body.appendChild(app);

    // Tab 切换
    app.querySelectorAll('.ha-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.ha-btn').forEach(b => b.classList.remove('ha-active'));
        btn.classList.add('ha-active');
        currentPage = 1;
        loadPosts(1);
      });
    });

    // 搜索（防抖）
    let searchTimer;
    document.getElementById('ha-search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (e.target.value.trim()) searchPosts(e.target.value.trim());
      }, 500);
    });
    document.getElementById('ha-search-btn').addEventListener('click', () => {
      const q = document.getElementById('ha-search-input').value.trim();
      if (q) searchPosts(q);
    });

    // 无限滚动
    window.addEventListener('scroll', () => {
      if (isLoading) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadMore();
      }
    });
  }

  async function loadPosts(page) {
    if (isLoading) return;
    isLoading = true;
    const container = document.getElementById('ha-posts');
    if (page === 1) container.innerHTML = '<div class="ha-loading">加载中...</div>';

    try {
      const { posts, hasMore } = await TreeholeAPI.getPosts(page, 15);
      if (page === 1) container.innerHTML = '';
      renderPosts(posts);
      currentPage = page;
      if (hasMore) {
        container.insertAdjacentHTML('beforeend', '<div class="ha-load-more" id="ha-load-trigger"></div>');
      }
    } catch(e) {
      container.innerHTML = `<div class="ha-error">加载失败: ${e.message}</div>`;
    }
    isLoading = false;
  }

  async function loadMore() {
    const trigger = document.getElementById('ha-load-trigger');
    if (trigger) trigger.remove();
    await loadPosts(currentPage + 1);
  }

  async function searchPosts(keyword) {
    const container = document.getElementById('ha-posts');
    container.innerHTML = '<div class="ha-loading">搜索中...</div>';
    try {
      const { posts } = await TreeholeAPI.search(keyword, 1, 30);
      container.innerHTML = '';
      if (posts.length === 0) {
        container.innerHTML = '<div class="ha-loading">没有找到相关帖子</div>';
        return;
      }
      renderPosts(posts);
    } catch(e) {
      container.innerHTML = `<div class="ha-error">搜索失败: ${e.message}</div>`;
    }
  }

  // ===== 渲染帖子（优化版）=====
  function renderPosts(posts) {
    const container = document.getElementById('ha-posts');
    
    // 用 DocumentFragment 批量插入
    const fragment = document.createDocumentFragment();
    
    posts.forEach(post => {
      const el = document.createElement('div');
      el.className = 'ha-post';
      el.dataset.pid = post.pid;
      
      // 图片占位
      const imagesHtml = post.images.length > 0
        ? `<div class="ha-post-images" data-images='${JSON.stringify(post.images.map(i=>i.id))}'></div>`
        : '';
      
      el.innerHTML = `
        <div class="ha-post-header">
          <span class="ha-pid">#${post.pid}</span>
          <span class="ha-time">${post.time}</span>
          ${post.is_top ? '<span class="ha-tag ha-top">置顶</span>' : ''}
          ${post.tags.map(t => `<span class="ha-tag">${esc(t)}</span>`).join('')}
        </div>
        <div class="ha-post-content">${esc(post.content)}</div>
        ${imagesHtml}
        <div class="ha-post-footer">
          <span class="ha-stat">💬 ${post.comment_num}</span>
          <span class="ha-stat">⭐ ${post.like_num}</span>
          <span class="ha-stat">🔄 ${post.share_num}</span>
        </div>
        <div class="ha-post-comments" id="ha-cmt-${post.pid}"></div>
      `;
      
      // 评论展开（事件委托）
      el.addEventListener('click', () => toggleComments(post.pid));
      
      fragment.appendChild(el);
    });
    
    container.appendChild(fragment);
    
    // 异步加载所有图片（并行）
    loadAllImages();
  }

  // ===== 并行加载所有图片 =====
  async function loadAllImages() {
    const placeholders = document.querySelectorAll('.ha-post-images:not([data-loaded])');
    
    // 并行处理所有图片占位符
    await Promise.all(Array.from(placeholders).map(async el => {
      el.dataset.loaded = 'true';
      try {
        const ids = JSON.parse(el.dataset.images);
        // 并行获取所有图片
        const urls = await Promise.all(ids.slice(0, 4).map(id => TreeholeAPI.getImage(id)));
        urls.forEach(url => {
          const img = document.createElement('img');
          img.src = url;
          img.className = 'ha-image';
          img.loading = 'lazy';
          el.appendChild(img);
        });
      } catch(e) {}
    }));
  }

  // ===== 评论展开/收起（优化版）=====
  async function toggleComments(pid) {
    const el = document.getElementById(`ha-cmt-${pid}`);
    if (!el) return;
    
    // 已展开则收起
    if (el.innerHTML) {
      el.innerHTML = '';
      el.style.display = 'none';
      return;
    }
    
    el.style.display = 'block';
    el.innerHTML = '<div class="ha-comment-loading">加载评论...</div>';
    
    try {
      const { comments } = await TreeholeAPI.getComments(pid, 1, 20);
      
      if (comments.length === 0) {
        el.innerHTML = '<div class="ha-comment-empty">暂无评论</div>';
        return;
      }
      
      // 批量渲染评论
      const html = comments.map(c => `
        <div class="ha-comment">
          <div class="ha-comment-meta">
            <span class="ha-comment-user">${esc(c.name_tag || '匿名')}</span>
            <span class="ha-comment-time">${c.time}</span>
            ${c.is_lz ? '<span class="ha-tag ha-lz">楼主</span>' : ''}
          </div>
          <div class="ha-comment-content">${esc(c.content)}</div>
        </div>
      `).join('');
      
      el.innerHTML = html;
    } catch(e) {
      el.innerHTML = '<div class="ha-comment-error">评论加载失败</div>';
    }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * Hollow Art - 树洞重绘 v0.1.0
 * 全新前端 UI
 */
(function() {
  'use strict';

  // 等待 TreeholeAPI 加载
  function waitForAPI() {
    return new Promise(resolve => {
      if (window.TreeholeAPI) resolve();
      else setTimeout(() => waitForAPI().then(resolve), 100);
    });
  }

  async function init() {
    await waitForAPI();
    console.log('[Hollow Art] TreeholeAPI ready, version:', TreeholeAPI.version);
    
    // 隐藏原版 UI
    hideOriginalUI();
    
    // 创建新 UI
    createApp();
    
    // 加载数据
    loadPosts();
  }

  function hideOriginalUI() {
    const style = document.createElement('style');
    style.textContent = `
      /* 隐藏原版树洞 UI */
      .app-wrapper { display: none !important; }
    `;
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
      <div class="ha-content" id="ha-posts">
        <div class="ha-loading">加载中...</div>
      </div>
    `;
    document.body.appendChild(app);
    
    // 绑定事件
    app.querySelectorAll('.ha-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.ha-btn').forEach(b => b.classList.remove('ha-active'));
        btn.classList.add('ha-active');
      });
    });
    
    document.getElementById('ha-search-btn').addEventListener('click', async () => {
      const keyword = document.getElementById('ha-search-input').value.trim();
      if (keyword) {
        const results = await TreeholeAPI.search(keyword);
        renderPosts(results.posts);
      }
    });
  }

  async function loadPosts(page = 1) {
    try {
      const { posts, total, hasMore } = await TreeholeAPI.getPosts(page, 20);
      renderPosts(posts, hasMore);
    } catch(e) {
      console.error('[Hollow Art] Failed to load posts:', e);
      document.getElementById('ha-posts').innerHTML = `
        <div class="ha-error">加载失败: ${e.message}</div>
      `;
    }
  }

  function renderPosts(posts, hasMore = false) {
    const container = document.getElementById('ha-posts');
    container.innerHTML = posts.map(post => `
      <div class="ha-post" data-pid="${post.pid}">
        <div class="ha-post-header">
          <span class="ha-pid">#${post.pid}</span>
          <span class="ha-time">${post.time}</span>
          ${post.is_top ? '<span class="ha-tag ha-top">置顶</span>' : ''}
          ${post.tags.map(t => `<span class="ha-tag">${t}</span>`).join('')}
        </div>
        <div class="ha-post-content">${escapeHtml(post.content)}</div>
        <div class="ha-post-images" id="ha-images-${post.pid}"></div>
        <div class="ha-post-footer">
          <span class="ha-stat">💬 ${post.comment_num}</span>
          <span class="ha-stat">⭐ ${post.like_num}</span>
          <span class="ha-stat">🔄 ${post.share_num}</span>
        </div>
        <div class="ha-post-comments" id="ha-comments-${post.pid}"></div>
      </div>
    `).join('') + (hasMore ? '<div class="ha-load-more">加载更多</div>' : '');
    
    // 加载图片
    posts.forEach(async post => {
      if (post.images.length > 0) {
        const container = document.getElementById(`ha-images-${post.pid}`);
        for (const img of post.images.slice(0, 4)) {
          try {
            const url = await TreeholeAPI.getImage(img.id);
            container.innerHTML += `<img src="${url}" class="ha-image">`;
          } catch(e) {}
        }
      }
    });
    
    // 点击帖子展开评论
    container.querySelectorAll('.ha-post').forEach(el => {
      el.addEventListener('click', async () => {
        const pid = parseInt(el.dataset.pid);
        const commentsEl = document.getElementById(`ha-comments-${pid}`);
        if (commentsEl.innerHTML) {
          commentsEl.innerHTML = '';
          return;
        }
        commentsEl.innerHTML = '<div class="ha-loading">加载评论...</div>';
        try {
          const { comments } = await TreeholeAPI.getComments(pid, 1, 10);
          commentsEl.innerHTML = comments.map(c => `
            <div class="ha-comment">
              <span class="ha-comment-user">${c.name_tag || '匿名'}</span>
              <span class="ha-comment-time">${c.time}</span>
              <div class="ha-comment-content">${escapeHtml(c.content)}</div>
            </div>
          `).join('');
        } catch(e) {
          commentsEl.innerHTML = `<div class="ha-error">评论加载失败</div>`;
        }
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

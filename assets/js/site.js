/* Grainley Foods site behaviour: search, wishlist, menu, gallery, variants, shop filters */
(function () {
  var ROOT = document.documentElement.getAttribute('data-root') || '';
  var CAT = window.GRAINLEY_CATALOG || [];
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // ---------- storage (wishlist lives only in this browser) ----------
  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem('grainley-wishlist') || '[]'); } catch (e) { return []; } },
    set: function (v) { try { localStorage.setItem('grainley-wishlist', JSON.stringify(v)); } catch (e) {} }
  };
  function toast(msg) {
    var t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function refreshWish() {
    var list = store.get();
    $$('.wish').forEach(function (b) { b.setAttribute('aria-pressed', list.indexOf(b.dataset.id) > -1 ? 'true' : 'false'); });
    $$('.wish-count').forEach(function (c) { c.textContent = list.length; c.style.display = list.length ? 'block' : 'none'; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.wish'); if (!b) return;
    e.preventDefault();
    var list = store.get(), id = b.dataset.id, i = list.indexOf(id);
    if (i > -1) { list.splice(i, 1); toast('Removed from wishlist'); } else { list.push(id); toast('Saved to your wishlist'); }
    store.set(list); refreshWish();
    document.dispatchEvent(new CustomEvent('wishlist-change', { detail: list }));
    if (document.body.dataset.page === 'wishlist') renderWishlist();
  });

  // ---------- mobile menu ----------
  var mt = $('.menu-toggle');
  if (mt) mt.addEventListener('click', function () { var n = $('nav.main'); var o = n.classList.toggle('open'); mt.setAttribute('aria-expanded', o); });

  // ---------- search ----------
  $$('.search').forEach(function (form) {
    var input = $('input', form), box = $('.results', form), sel = -1;
    function render(q) {
      q = q.trim().toLowerCase();
      if (!q) { box.style.display = 'none'; return; }
      var words = q.split(/\s+/);
      var hits = CAT.filter(function (p) { var h = (p.name + ' ' + p.keywords).toLowerCase(); return words.every(function (w) { return h.indexOf(w) > -1; }); }).slice(0, 8);
      box.innerHTML = hits.length ? hits.map(function (p) {
        return '<a href="' + ROOT + p.url + '"><img src="' + ROOT + p.img + '" alt="" loading="lazy"><span><b>' + p.name + '</b><small>' + p.sub + ' · from ₹' + p.price + '</small></span></a>';
      }).join('') : '<a href="' + ROOT + 'shop.html"><span><b>No match for “' + q.replace(/</g, '') + '”</b><small>Browse all products</small></span></a>';
      box.style.display = 'block'; sel = -1;
    }
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (e) {
      var items = $$('a', box); if (!items.length) return;
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); e.preventDefault(); }
      else if (e.key === 'Escape') { box.style.display = 'none'; return; }
      else return;
      items.forEach(function (a, i) { a.classList.toggle('on', i === sel); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var on = $('a.on', box) || $('a', box);
      if (on && input.value.trim()) location.href = on.href; else location.href = ROOT + 'shop.html';
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) box.style.display = 'none'; });
  });

  // ---------- product gallery + lightbox ----------
  var main = $('.gallery .main img');
  if (main) {
    $$('.thumbs button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.thumbs button').forEach(function (x) { x.setAttribute('aria-current', 'false'); });
        b.setAttribute('aria-current', 'true');
        main.src = b.dataset.src; main.alt = b.dataset.alt || main.alt;
        main.classList.toggle('photo', b.dataset.kind === 'photo');
      });
    });
    var lb = $('.lb');
    $('.gallery .main').addEventListener('click', function () { $('img', lb).src = main.src; lb.classList.add('open'); });
    lb.addEventListener('click', function (e) { if (e.target.tagName !== 'IMG') lb.classList.remove('open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.classList.remove('open'); });
  }

  // ---------- variants (single / pack of 2) ----------
  $$('.variant').forEach(function (v) {
    v.addEventListener('click', function () {
      $$('.variant').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      v.setAttribute('aria-pressed', 'true');
      var a = $('.buy-amz'); a.href = v.dataset.url;
      var p = $('.buy-price'); if (p) p.textContent = '₹' + v.dataset.price;
    });
  });

  // ---------- shop filters ----------
  if (document.body.dataset.page === 'shop') {
    var grid = $('.grid-cards'), cards = $$('.card', grid), chips = $$('.chip'), sortSel = $('#sort');
    var params = new URLSearchParams(location.search), current = params.get('cat') || 'all';
    function apply() {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.cat === current ? 'true' : 'false'); });
      var shown = 0;
      cards.forEach(function (c) { var ok = current === 'all' || c.dataset.cat.split(' ').indexOf(current) > -1; c.style.display = ok ? '' : 'none'; if (ok) shown++; });
      $('.count-shown').textContent = shown + (shown === 1 ? ' product' : ' products');
      var h = $('.cat-title'); if (h) h.textContent = (chips.filter(function (c) { return c.dataset.cat === current; })[0] || chips[0]).dataset.title;
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { current = c.dataset.cat; history.replaceState(null, '', current === 'all' ? 'shop.html' : 'shop.html?cat=' + current); apply(); }); });
    sortSel.addEventListener('change', function () {
      var v = sortSel.value;
      cards.sort(function (a, b) {
        if (v === 'low') return a.dataset.price - b.dataset.price;
        if (v === 'high') return b.dataset.price - a.dataset.price;
        if (v === 'name') return a.dataset.name.localeCompare(b.dataset.name);
        return a.dataset.order - b.dataset.order;
      }).forEach(function (c) { grid.appendChild(c); });
    });
    apply();
  }

  // ---------- wishlist page ----------
  function renderWishlist() {
    var list = store.get(), grid = $('#wish-grid'), empty = $('#wish-empty');
    var items = list.map(function (id) { return CAT.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
    empty.style.display = items.length ? 'none' : 'block';
    grid.innerHTML = items.map(function (p) {
      return '<article class="card"><button class="wish" data-id="' + p.id + '" aria-label="Remove ' + p.name + ' from wishlist" aria-pressed="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3.3 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3C20.7 5 23 8.4 21.5 11.8 19.5 16.4 12 21 12 21z"/></svg></button>' +
        '<a class="media" href="' + ROOT + p.url + '" style="--bg:' + p.bg + '"><img src="' + ROOT + p.img + '" alt="' + p.name + '" loading="lazy"></a>' +
        '<div class="body"><span class="tier">' + p.sub + '</span><h3><a href="' + ROOT + p.url + '">' + p.name + '</a></h3>' +
        '<div class="row"><div class="price">₹' + p.price + '<small>on Amazon</small></div><a class="btn btn-amz" href="' + p.amazon + '" target="_blank" rel="noopener">Buy on Amazon</a></div></div></article>';
    }).join('');
  }
  if (document.body.dataset.page === 'wishlist') renderWishlist();

  // ---------- contact form → email ----------
  var cf = $('#contact-form');
  if (cf) cf.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(cf);
    var body = 'Name: ' + f.get('name') + '\nPhone: ' + (f.get('phone') || '-') + '\nTopic: ' + f.get('topic') + '\n\n' + f.get('message');
    location.href = 'mailto:wecare@grainleyfoods.com?subject=' + encodeURIComponent('Website enquiry: ' + f.get('topic')) + '&body=' + encodeURIComponent(body);
  });

  document.addEventListener('wishlist-refresh', function () { refreshWish(); if (document.body.dataset.page === 'wishlist') renderWishlist(); });
  refreshWish();
  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();

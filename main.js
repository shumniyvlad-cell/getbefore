/* Before · main.js. Без зависимостей: лента-скриншоты, появление секций, счётчики, оплата, анкета. */
(() => {
  'use strict';

  const cfg = window.BEFORE_CONFIG || {};
  const plans = cfg.plans || {};
  const reduce = !/[?&]motion=1/.test(location.search) && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmtRub = n => Number(n).toLocaleString('ru-RU') + ' ₽';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const scrollTo = el => el && el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

  function fetchTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, Object.assign({}, opts, { signal: ctrl.signal })).finally(() => clearTimeout(timer));
  }

  /* ---------- Конфиг → страница ---------- */

  $$('[data-response-time]').forEach(el => { if (cfg.responseTime) el.textContent = cfg.responseTime; });
  // Ссылка в чат с уже набранным текстом. Параметр ?text= поддерживают
  // мобильные клиенты и Desktop; веб-версия его игнорирует и просто
  // открывает чат — поэтому текст не должен нести ничего обязательного.
  function tgHref(planKey) {
    if (!cfg.telegram) return '#';
    const tpl = cfg.tgMessage || '';
    if (!tpl) return cfg.telegram;
    const plan = planKey && plans[planKey];
    const suffix = plan && cfg.tgPlanSuffix
      ? cfg.tgPlanSuffix.replace('{title}', plan.title)
      : '';
    const text = tpl.replace('{plan}', suffix);
    const sep = cfg.telegram.indexOf('?') === -1 ? '?' : '&';
    return cfg.telegram + sep + 'text=' + encodeURIComponent(text);
  }

  $$('[data-tg-link]').forEach(a => {
    if (cfg.telegram) a.href = tgHref(a.dataset.tgLink || null);
  });

  // Кнопки «Обсудить» ведут прямо в чат с набранным текстом: продажа идёт
  // в личке, лишний шаг через форму терял людей. Текстовые ссылки (без
  // класса btn) по-прежнему прокручивают к форме — кому удобнее, заполнит её.
  if (cfg.telegram) {
    $$('[data-discuss]').forEach(el => {
      if (!el.classList.contains('btn')) return;
      el.href = tgHref(el.dataset.discuss || null);
      el.target = '_blank';
      el.rel = 'noopener';
      el.dataset.tgReady = '1';
    });
  }
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
  $$('[data-doc]').forEach(a => {
    const url = cfg.docs && cfg.docs[a.dataset.doc];
    if (url) a.href = url; else a.remove();
  });
  Object.keys(plans).forEach(key => {
    const p = plans[key];
    $$(`[data-price="${key}"]`).forEach(el => { el.textContent = fmtRub(p.price); });
    const opt = $(`select[name="plan"] option[value="${key}"]`);
    if (opt) opt.textContent = `${p.title}, ${fmtRub(p.price)} в месяц`;
  });

  /* ---------- Бегущая лента ---------- */

  function initTape() {
    const track = $('[data-tape]');
    if (!track || track.dataset.ready) return;
    track.innerHTML += track.innerHTML;
    track.dataset.ready = '1';
  }

  /* ---------- Появление секций ---------- */

  function initReveal() {
    const targets = $$('.sec__head, .mark, .sieve__fig, .step, .tile, .plan, .note, .form__panel, .aside, .faq details, .phone-wrap, .pricing__foot');
    targets.forEach(el => {
      el.dataset.reveal = '';
      const siblings = Array.from(el.parentElement.children).filter(c => c.dataset && 'reveal' in c.dataset);
      el.style.setProperty('--i', String(siblings.indexOf(el)));
    });
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(el => io.observe(el));
  }

  /* ---------- Живая лента: три экрана ---------- */

  const TG = [
    { kind: 'noise', name: 'Илья', color: 0, text: 'Всем привет, скинул запись вчерашнего эфира в закреп' },
    {
      kind: 'lead', name: 'Марина К.', color: 2,
      text: 'Кто-нибудь знает нормального подрядчика по Директу для клиники? Бюджет около 150к в месяц, Москва. Прошлые слили полгода',
      card: { need: 'подрядчик по Директу', detail: 'Клиника, Москва, 150 000 ₽ в месяц', score: 92, draft: 'Марина, здравствуйте. Увидел ваш запрос про Директ для клиники…' }
    },
    { kind: 'noise', name: 'Артём', color: 1, text: 'Ищу работу таргетологом, опыт 3 года, кейсы в личке' },
    {
      kind: 'lead', name: 'Сергей Л.', color: 6,
      text: 'Посоветуйте агентство на SEO для стоматологии в Питере. Бюджет до 80к, нужен кто реально делал медицину',
      card: { need: 'SEO для стоматологии', detail: 'Медицина, Санкт-Петербург, до 80 000 ₽ в месяц', score: 88, draft: 'Сергей, добрый день. Видел ваш запрос про SEO для стоматологии…' }
    },
    { kind: 'noise', name: 'Promo', color: 3, text: 'Курс по нейросетям для маркетологов, скидка 50% только сегодня' },
    {
      kind: 'lead', name: 'Оксана', color: 4,
      text: 'Нужен подрядчик на сайт для завода металлоконструкций, срочно, есть ТЗ. Кто делал промышленные сайты?',
      card: { need: 'сайт для завода', detail: 'B2B производство, есть ТЗ, срочно', score: 85, draft: 'Оксана, здравствуйте. По сайту для завода: делали три промышленных…' }
    },
    { kind: 'noise', name: 'Тимур', color: 5, text: 'Кто на чём ведёт отчётность клиентам, гугл-таблицы или что-то поумнее?' }
  ];

  const TH = [
    {
      kind: 'lead', name: 'daria.stretch', text: 'Ищу того, кто настроит рекламу для студии растяжки в Питере. Два раза обжигалась на фрилансерах, нужен человек с кейсами в фитнесе. Бюджет 60к',
      likes: 14, replies: 3, reposts: 2, age: '2 мин',
      card: { need: 'реклама для студии растяжки', detail: 'Фитнес, Санкт-Петербург, 60 000 ₽ в месяц', score: 89, draft: 'Дарья, здравствуйте. Прочитал ваш пост про рекламу для студии…' }
    },
    { kind: 'noise', name: 'artur.digital', text: 'Три месяца веду Threads каждый день. Итог: 40 подписчиков и один клиент. Это нормально или я что-то делаю не так?', likes: 128, replies: 46, reposts: 9, age: '4 ч.' },
    {
      kind: 'lead', name: 'olga.finance', text: 'Посоветуйте бухгалтера на аутсорс для ИП на УСН с сотрудниками, нас пятеро. Прошлый пропал за неделю до отчётности',
      likes: 9, replies: 7, reposts: 1, age: '11 мин',
      card: { need: 'бухгалтер на аутсорс', detail: 'ИП на УСН, 5 сотрудников', score: 84, draft: 'Ольга, добрый день. Увидел ваш пост про бухгалтера…' }
    },
    { kind: 'noise', name: 'nikita.sells', text: 'Продажи в Threads работают, если писать как человек, а не как лендинг. Тред с примерами ниже', likes: 302, replies: 58, reposts: 41, age: '6 ч.' },
    {
      kind: 'lead', name: 'natalia.krd', text: 'Подскажите юриста по банкротству физлиц в Краснодаре. Долг 1,8 млн, приставы уже списывают, нужно срочно',
      likes: 5, replies: 11, reposts: 0, age: '3 мин',
      card: { need: 'юрист по банкротству физлиц', detail: 'Краснодар, долг 1 800 000 ₽, срочно', score: 95, draft: 'Наталья, здравствуйте. Прочитал про списания приставов…' }
    }
  ];

  const TG_COLORS = [['#ff885e', '#ff516a'], ['#82b1ff', '#665fff'], ['#5fb4ea', '#2f7fd8'], ['#a0de7e', '#54cb68'], ['#ffcd6a', '#ffa85c'], ['#e0a2f3', '#d669ed'], ['#53edd6', '#28c9b7']];
  const SVG_HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.1c2-.2 3.8.8 5.4 2.6 1.6-1.8 3.4-2.8 5.4-2.6 3.6.4 5.7 4.2 4.2 7.6C19.5 16.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  const SVG_REPLY = '<svg viewBox="0 0 24 24"><path d="M21 12c0 4.4-4 8-9 8-1.3 0-2.6-.2-3.7-.7L4 20l1.1-3.6C3.8 15.2 3 13.7 3 12c0-4.4 4-8 9-8s9 3.6 9 8z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  const SVG_REPOST = '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4M21 7H9a5 5 0 0 0-5 5M7 21l-4-4 4-4M3 17h12a5 5 0 0 0 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SVG_SEND = '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  function initStage() {
    const stage = $('[data-stage]');
    if (!stage) return;
    const tgList = $('[data-tg] [data-list]');
    const thList = $('[data-th] [data-list]');
    const botList = $('[data-bot] [data-list]');
    const clocks = $$('[data-clock]', stage);
    let minutes = 12 * 60 + 3;
    let ti = 0, hi = 0, turn = 0, running = false, timer = 0;
    const timers = new Set();

    const fmt = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const tick = () => { minutes++; clocks.forEach(c => { c.textContent = fmt(minutes); }); };
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

    function push(list, el, max) {
      el.classList.add('is-new');
      list.appendChild(el);
      while (list.children.length > max) list.removeChild(list.firstElementChild);
      const box = list.classList.contains('tg__inner') ? list.parentElement : list;
      box.scrollTo({ top: box.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    }

    function tgMessage(m) {
      const [c1, c2] = TG_COLORS[m.color % TG_COLORS.length];
      const el = document.createElement('div');
      el.className = 'tgm';
      el.innerHTML =
        `<span class="tgm__ava" style="--c1:${c1};--c2:${c2}">${esc(m.name[0])}</span>` +
        `<div class="tgm__bubble"><b class="tgm__name" style="color:${c2}">${esc(m.name)}</b>` +
        `<p>${esc(m.text)}<span class="tgm__time">${fmt(minutes)}</span></p></div>`;
      return el;
    }

    function thPost(m) {
      const el = document.createElement('article');
      el.className = 'thp';
      el.innerHTML =
        `<span class="thp__ava">${esc(m.name[0].toUpperCase())}</span>` +
        `<div class="thp__body"><div class="thp__head"><b>${esc(m.name)}</b><span class="thp__time">${esc(m.age || 'только что')}</span><span class="thp__dots"></span></div>` +
        `<p>${esc(m.text)}</p>` +
        `<div class="thp__actions">` +
        `<span class="thp__act">${SVG_HEART}<i>${m.likes}</i></span>` +
        `<span class="thp__act">${SVG_REPLY}<i>${m.replies}</i></span>` +
        `<span class="thp__act">${SVG_REPOST}${m.reposts ? `<i>${m.reposts}</i>` : ''}</span>` +
        `<span class="thp__act">${SVG_SEND}</span>` +
        `</div></div>`;
      return el;
    }

    function botCard(m, source) {
      const c = m.card;
      const el = document.createElement('div');
      el.className = 'tgm tgm--bot';
      el.innerHTML =
        `<span class="tgm__ava tgm__ava--bot">B</span>` +
        `<div class="tgm__stack"><div class="tgm__bubble tgm__bubble--bot">` +
        `<b>Запрос: ${esc(c.need)}</b><p>${esc(c.detail)}. Совпадение ${c.score}.</p>` +
        `<p class="tgm__src">${esc(m.name)}, ${esc(source)}, ${fmt(minutes)}</p>` +
        `<span class="tgm__link">Открыть сообщение</span>` +
        `<p class="tgm__draft">Черновик: «${esc(c.draft)}»</p>` +
        `<span class="tgm__time">${fmt(minutes + 1)}</span></div>` +
        `<div class="tgm__keys"><span>В тему</span><span>Мимо</span><span data-claim>В работе</span></div></div>`;
      return el;
    }

    function serviceMsg(text) {
      const el = document.createElement('div');
      el.className = 'tgm__service';
      el.textContent = text;
      return el;
    }

    function deliver(m, source) {
      later(() => {
        if (!running) return;
        const card = botCard(m, source);
        push(botList, card, 4);
        later(() => {
          const key = $('[data-claim]', card);
          if (key) key.classList.add('is-pressed');
          push(botList, serviceMsg('Анна взяла запрос в работу'), 5);
        }, 2600);
      }, 1100);
    }

    function step() {
      if (!running) return;
      tick();
      let wait = 2600;
      if (turn % 2 === 0) {
        const m = TG[ti % TG.length]; ti++;
        push(tgList, tgMessage(m), 5);
        if (m.kind === 'lead') { deliver(m, '@marketing_chat'); wait = 5200; }
      } else {
        const m = TH[hi % TH.length]; hi++;
        push(thList, thPost(m), 3);
        if (m.kind === 'lead') { deliver(m, 'Threads'); wait = 5200; }
      }
      turn++;
      timer = later(step, wait);
    }

    function start() {
      if (running) return;
      running = true;
      timer = later(step, 600);
    }
    function stop() {
      running = false;
      timers.forEach(t => clearTimeout(t));
      timers.clear();
    }

    // Стартовое состояние, чтобы экраны не были пустыми
    push(tgList, tgMessage(TG[0]), 5); ti = 1;
    push(thList, thPost(TH[1]), 3); hi = 2; turn = 0;
    thList.scrollTop = 0;

    if (reduce) {
      push(tgList, tgMessage(TG[1]), 5); ti = 2;
      push(thList, thPost(TH[0]), 3);
      const card = botCard(TG[1], '@marketing_chat');
      push(botList, card, 4);
      $('[data-claim]', card).classList.add('is-pressed');
      push(botList, serviceMsg('Анна взяла запрос в работу'), 5);
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) start(); else stop(); });
    }, { threshold: 0.15 });
    io.observe(stage);
  }

  /* ---------- Счётчики ---------- */

  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length) return;
    const fmt = n => n.toLocaleString('ru-RU');
    const finish = el => { el.textContent = fmt(+el.dataset.count); };
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(finish); return; }

    // Ширину резервируем по финальному числу, иначе строка прыгает на каждом кадре.
    const reserve = el => {
      finish(el);
      el.style.minWidth = Math.ceil(el.getBoundingClientRect().width + 2) + 'px';
      el.style.visibility = 'hidden';
    };
    const animate = el => {
      el.style.visibility = '';
      const target = +el.dataset.count;
      const dur = 1000, t0 = performance.now();
      const ease = t => 1 - (1 - t) * (1 - t);
      let done = false;
      const end = () => { if (done) return; done = true; finish(el); };
      const step = now => {
        if (done) return;
        const p = Math.min(1, (now - t0) / dur);
        if (p >= 1) { end(); return; }
        el.textContent = fmt(Math.round(target * ease(p)));
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(end, dur + 150);   // финал ставим в любом случае, даже если кадры дропнулись
    };
    const ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(() => {
      els.forEach(reserve);
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          animate(en.target);
        });
      }, { threshold: 0.2 });
      els.forEach(el => io.observe(el));
    });
  }

  /* ---------- Хиро: печатает → сообщение → карточка ---------- */

  function initScene() {
    const card = $('[data-scene]');
    if (!card) return;
    const clock = $('[data-scene-clock]', card);
    const set = (step, time) => { card.dataset.step = step; if (clock) clock.textContent = time; };
    if (reduce) { set('3', '12:05'); return; }
    const steps = [
      ['1', '12:04', 2600],
      ['2', '12:04', 2400],
      ['3', '12:05', 3800],
      ['0', '12:04', 500]
    ];
    let i = 0;
    const tick = () => {
      const [step, time, wait] = steps[i];
      set(step, time);
      i = (i + 1) % steps.length;
      setTimeout(tick, wait);
    };
    tick();
  }

  /* ---------- Обсудить: кнопки ведут к форме ---------- */

  function initDiscuss() {
    const section = document.getElementById('discuss');
    if (!section) return;
    $$('[data-discuss]').forEach(el => el.addEventListener('click', e => {
      if (el.dataset.tgReady) return;   // ведёт в чат, не мешаем переходу
      e.preventDefault();
      const plan = el.dataset.discuss;
      const sel = $('select[name="plan"]');
      if (sel && plan && plans[plan]) sel.value = plan;
      scrollTo(section);
      const first = $('input[name="name"]', section);
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 600);
    }));
  }

  /* ---------- Заявка ---------- */

  function initForm() {
    const form = $('[data-form]');
    if (!form) return;
    const status = $('[data-status]', form);
    const done = $('[data-done]');
    const submit = $('[data-submit]', form);
    const contactOk = v => /^(@?[a-zA-Z0-9_]{4,32}|(https?:\/\/)?t\.me\/[a-zA-Z0-9_]{4,32}|\+?[\d\s()-]{10,18})$/.test(v);

    function setErr(input, msg) {
      const field = input.closest('.field');
      let err = $('.field__err', field);
      if (!msg) {
        field.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
        if (err) err.remove();
        return;
      }
      field.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      if (!err) {
        err = document.createElement('span');
        err.className = 'field__err';
        field.appendChild(err);
      }
      err.textContent = msg;
    }

    function validate() {
      let first = null;
      const name = form.elements.name;
      const contact = form.elements.contact;
      let msg = name.value.trim() ? '' : 'Как к вам обращаться?';
      setErr(name, msg);
      if (msg) first = name;
      const v = contact.value.trim();
      msg = !v ? 'Оставьте Telegram или телефон' : (contactOk(v) ? '' : 'Нужен @username, ссылка t.me или номер телефона');
      setErr(contact, msg);
      if (msg && !first) first = contact;
      if (first) { first.focus(); return false; }
      return true;
    }

    function summary(d) {
      return [
        'Заявка Before',
        `Имя: ${d.name}`,
        `Связь: ${d.contact}`,
        d.planTitle && `Тариф: ${d.planTitle}`,
        d.company && `Компания: ${d.company}`,
        d.offer && `Что продаёт: ${d.offer}`
      ].filter(Boolean).join('\n');
    }

    function copy(text) {
      try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) { /* без буфера */ }
    }

    function finish(data, manual) {
      form.hidden = true;
      done.hidden = false;
      if (manual) {
        $('[data-done-text]', done).textContent = 'Отправка с сайта ещё не подключена. Текст заявки ниже уже скопирован: вставьте его в чат, и мы ответим в Telegram.';
        const ta = $('[data-copy]', done);
        ta.value = summary(data);
        ta.hidden = false;
        copy(ta.value);
      }
      scrollTo(done);
    }

    form.addEventListener('input', e => {
      if (e.target.matches('input, textarea, select')) setErr(e.target, '');
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validate()) return;
      const data = Object.fromEntries(new FormData(form).entries());
      Object.keys(data).forEach(k => { data[k] = String(data[k]).trim(); });
      if (/^[a-zA-Z0-9_]{4,32}$/.test(data.contact)) data.contact = '@' + data.contact;
      data.type = 'lead';
      data.page = window.location.href;
      data.sentAt = new Date().toISOString();
      data.planTitle = data.plan ? ((plans[data.plan] || {}).title || data.plan) : 'пока не выбран';
      status.classList.remove('is-error');

      if (!cfg.formEndpoint) { finish(data, true); return; }

      submit.disabled = true;
      status.textContent = 'Отправляем…';
      try {
        const res = await fetchTimeout(cfg.formEndpoint, { method: 'POST', body: JSON.stringify(data) }, 20000);
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || 'server');
        status.textContent = '';
        finish(data, false);
      } catch (err) {
        status.classList.add('is-error');
        status.textContent = 'Не отправилось. Попробуйте ещё раз или напишите в Telegram: текст заявки уже в буфере обмена.';
        copy(summary(data));
        submit.disabled = false;
      }
    });
  }

  initTape();
  initReveal();
  initStage();
  initCounters();
  initScene();
  initDiscuss();
  initForm();
})();

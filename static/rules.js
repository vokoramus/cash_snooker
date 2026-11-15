const RULES_CONTENT = {
  ru: {
    btnFull: '? Правила',
    btnShort: '?',
    title: '🎱 Правила Cash Snooker',
    close: 'Понятно',
    sections: [
      {
        heading: '1. Цель и очки (Банк стола — 69 очков)',
        items: [
          'Каждый красный шар на полке приносит 1 очко.',
          'Каждый купленный и забитый цветной шар приносит двойной номинал: Жёлтый — 4, Зелёный — 6, Коричневый — 8, Синий — 10, Розовый — 12, Чёрный — 14.',
          'Формула счёта: (Цветные × 2) + Красные на полке − Долг.'
        ]
      },
      {
        heading: '2. Красные шары и лимит полки',
        items: [
          'Пока на столе есть хотя бы один цветной шар, максимум на полке игрока — 8 красных. Каждый красный сверх лимита сразу возвращается на центральную линию стола.',
          'Как только все цветные разыграны, лимит в 8 красных снимается — можно забирать все оставшиеся красные.'
        ]
      },
      {
        heading: '3. Заказ и покупка цветных шаров',
        items: [
          'Чтобы бить по цветному шару, нужно нажать кнопку его номинала (2–7) до удара. Повторный клик отменяет заказ.',
          'Забил заказанный цветной без фола — его стоимость (2–7 красных) списывается с полки и возвращается на стол, а серия продолжается.',
          'Промахнулся по заказанному цветному — с полки списывается 1 красный (или +1 в долг), ход переходит сопернику.'
        ]
      },
      {
        heading: '4. Фолы, долг и концовка партии',
        items: [
          'Любой фол (удар не по прицельному шару, промах мимо шаров, падение битка или чужого шара) наказывается штрафом в 1 красный: шар возвращается с полки на стол, а если полка пуста — записывается +1 в Долг.',
          'Следующие забитые красные в первую очередь гасят Долг и возвращаются на стол.',
          'Если все цветные забиты и оставшихся красных на столе не хватает отстающему даже для ничьей — объявляется досрочная победа.',
          'При равном счёте в конце фрейма выставляется решающий красный (Re-spot Red) на точку чёрного, и соперник бьёт с руки из сектора D.'
        ]
      }
    ]
  },
  en: {
    btnFull: '? Rules',
    btnShort: '?',
    title: '🎱 Cash Snooker Rules',
    close: 'Got it',
    sections: [
      {
        heading: '1. Objective & Scoring (Total Pot — 69 pts)',
        items: [
          'Each red ball on your shelf is worth 1 point.',
          'Each potted color ball is worth double its face value: Yellow — 4, Green — 6, Brown — 8, Blue — 10, Pink — 12, Black — 14.',
          'Score formula: (Colors × 2) + Shelf Reds − Debt.'
        ]
      },
      {
        heading: '2. Reds & 8-Ball Shelf Limit',
        items: [
          'While at least one color remains on the table, your shelf holds up to 8 reds. Any red potted over the limit immediately spots back on the center line.',
          'Once all colors are cleared, the 8-red limit is lifted.'
        ]
      },
      {
        heading: '3. Calling & Buying Colors',
        items: [
          'To shoot a color ball, select its value button (2–7) before your shot. Click again to cancel.',
          'Pot the called color cleanly: its cost (2–7 reds) is deducted from your shelf back onto the table, and your break continues.',
          'Miss the called color without a foul: 1 red penalty (or +1 Debt) and turn passes.'
        ]
      },
      {
        heading: '4. Fouls, Debt & Endgame',
        items: [
          'Any foul costs 1 red from your shelf back to the table (or +1 Debt if your shelf is empty).',
          'Subsequent potted reds pay off your Debt first and return to the table.',
          'Once all colors are gone, if the trailing player cannot reach a tie with the remaining table reds, an early victory is awarded.',
          'If scores are tied at the end, a single Re-spot Red is placed on the black spot with ball-in-hand in the D.'
        ]
      }
    ]
  }
};

const RulesModal = (() => {
  function getLang() {
    return typeof currentLang !== 'undefined' && RULES_CONTENT[currentLang] ? currentLang : 'ru';
  }

  function renderContent() {
    const data = RULES_CONTENT[getLang()];
    const titleEl = document.getElementById('rules-modal-title');
    const bodyEl = document.getElementById('rules-modal-body');
    const closeBtn = document.getElementById('rules-modal-close');

    if (titleEl) titleEl.innerText = data.title;
    if (closeBtn) closeBtn.innerText = data.close;
    if (!bodyEl) return;

    bodyEl.innerHTML = data.sections.map(sec => `
      <div class="rules-section">
        <h4>${sec.heading}</h4>
        <ul>
          ${sec.items.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  }

  function open() {
    let overlay = document.getElementById('rules-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'rules-overlay';
      overlay.className = 'rules-overlay';
      overlay.onclick = (e) => {
        if (e.target === overlay) close();
      };

      overlay.innerHTML = `
        <div class="rules-modal">
          <div class="rules-header">
            <h3 id="rules-modal-title"></h3>
            <button type="button" class="rules-x" onclick="RulesModal.close()">✕</button>
          </div>
          <div id="rules-modal-body" class="rules-body"></div>
          <div class="rules-footer">
            <button type="button" id="rules-modal-close" onclick="RulesModal.close()"></button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    renderContent();
    overlay.style.display = 'flex';
  }

  function close() {
    const overlay = document.getElementById('rules-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function refreshLang() {
    const data = RULES_CONTENT[getLang()];
    const btn = document.getElementById('btn-rules');
    if (btn) {
      btn.innerHTML = `<span class="rules-label-full">${data.btnFull}</span><span class="rules-label-short">${data.btnShort}</span>`;
    }
    const overlay = document.getElementById('rules-overlay');
    if (overlay && overlay.style.display === 'flex') {
      renderContent();
    }
  }

  function init() {
    const controls = document.querySelector('.controls');
    if (!controls || document.getElementById('btn-rules')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-rules';
    btn.type = 'button';
    btn.style.background = '#546e7a';
    btn.onclick = open;

    const langBtn = document.getElementById('btn-lang');
    if (langBtn) {
      controls.insertBefore(btn, langBtn);
    } else {
      controls.appendChild(btn);
    }

    refreshLang();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  return { init, open, close, refreshLang };
})();

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => RulesModal.init());
} else {
  RulesModal.init();
}

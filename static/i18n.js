let currentLang = 'ru';

const I18N = {
  ru: {
    title: '🎱 CASH SNOOKER',
    player1: 'Игрок 1',
    player2: 'Игрок 2',
    score: 'Счёт',
    score2: 'Счёт 2',
    debt: 'Долг',
    redsLabel: 'Полка красных',
    colorsLabel: 'Купленные цветные:',
    buyLabel: 'Купить шар:',
    noLimit: 'без лимита',
    cancel: 'ОТМЕНА',
    newGame: 'Новая партия',
    moveBalls: '🖐 Двигать шары',
    mpPlaceholder: 'Код комнаты',
    mpJoin: 'Войти',

    mpOnline: '🌐 Онлайн (1 на 1)',
    mpLeave: '✖ Выйти в Single Mode',
    mpRoom: 'Комната',
    mpRole1: 'Вы: Игрок 1',
    mpRole2: 'Вы: Игрок 2',
    mpWait: 'Ожидание соперника (ссылка скопирована)...',
    mpJoined: 'Соперник в комнате!',
    mpPlaying: 'Матч идёт!',
    mpLeft: 'Соперник отключился.',
    mpFull: 'Комната уже заполнена (2/2). Вы играете локально.',
    mpLost: 'Соединение с сервером потеряно.',

    colors: {
      yellow: 'Жёлт.',
      green: 'Зел.',
      brown: 'Кор.',
      blue: 'Син.',
      pink: 'Роз.',
      black: 'Чёрн.'
    },
    statusStart: 'Ход Игрока 1. Поставьте биток в секторе D или тяните для удара.',
    statusBought: (p, color, cost) => `Игрок ${p} заказал ${color} (спишется ${cost} кр. при забитии, промах: -1 кр.).`,
    statusFoul: (p) => `ФОЛ! Штраф 1 красный. Ход переходит к Игроку ${p}.`,
    statusMiss: (p) => `Промах. Ход Игрока ${p}.`,
    statusContinue: (p) => `Отличный удар! Игрок ${p} продолжает серию.`,
    statusTie: (p) => `НИЧЬЯ! Объявляется RE-SPOT RED! Игрок ${p} бьёт с руки.`,
    statusRespotMiss: (p) => `Промах на Re-spot Red. Ход переходит к Игроку ${p}.`,
    statusRespotFoul: (s1, s2, w) => `ФОЛ на Re-spot Red! Счёт ${s1}:${s2}. Победил Игрок ${w}!`,
    statusRespotPot: (s1, s2, w) => `RE-SPOT RED ЗАБИТ! Счёт ${s1}:${s2}. Победил Игрок ${w}!`,
    statusWin: (s1, s2, w) => `ПАРТИЯ ОКОНЧЕНА! Счёт ${s1}:${s2}. Победил Игрок ${w}!`,
    statusEarlyWin: (s1, s2, w) => `ДОСРОЧНАЯ ПОБЕДА! Оставшихся красных не хватит. Счёт ${s1}:${s2}. Победил Игрок ${w}!`,
  },
  en: {
    title: '🎱 CASH SNOOKER',
    player1: 'Player 1',
    player2: 'Player 2',
    score: 'Score',
    score2: 'Score 2',
    debt: 'Debt',
    redsLabel: 'Reds shelf',
    colorsLabel: 'Bought colors:',
    buyLabel: 'Buy ball:',
    noLimit: 'no limit',
    cancel: 'CANCEL',
    newGame: 'New Frame',
    moveBalls: '🖐 Move balls',
    mpPlaceholder: 'Room code',
    mpJoin: 'Join',

    mpOnline: '🌐 Online (1v1)',
    mpLeave: '✖ Exit to Single Mode',
    mpRoom: 'Room',
    mpRole1: 'You: Player 1',
    mpRole2: 'You: Player 2',
    mpWait: 'Waiting for opponent (link copied)...',
    mpJoined: 'Opponent joined!',
    mpPlaying: 'Match in progress!',
    mpLeft: 'Opponent disconnected.',
    mpFull: 'Room is full (2/2). Playing locally.',
    mpLost: 'Connection to server lost.',

    colors: {
      yellow: 'Yellow',
      green: 'Green',
      brown: 'Brown',
      blue: 'Blue',
      pink: 'Pink',
      black: 'Black'
    },
    statusStart: 'Player 1 turn. Place cue ball in the D or drag to shoot.',
    statusBought: (p, color, cost) => `Player ${p} called ${color} (costs ${cost} reds if potted, miss: -1 red).`,
    statusFoul: (p) => `FOUL! 1 red penalty. Turn passes to Player ${p}.`,
    statusMiss: (p) => `Miss. Player ${p} turn.`,
    statusContinue: (p) => `Great pot! Player ${p} continues the break.`,
    statusTie: (p) => `TIE! RE-SPOT RED! Player ${p} plays ball-in-hand.`,
    statusRespotMiss: (p) => `Miss on Re-spot Red. Turn passes to Player ${p}.`,
    statusRespotFoul: (s1, s2, w) => `FOUL on Re-spot Red! Score ${s1}:${s2}. Player ${w} wins!`,
    statusRespotPot: (s1, s2, w) => `RE-SPOT RED POTTED! Score ${s1}:${s2}. Player ${w} wins!`,
    statusWin: (s1, s2, w) => `FRAME OVER! Score ${s1}:${s2}. Player ${w} wins!`,
    statusEarlyWin: (s1, s2, w) => `EARLY VICTORY! Not enough reds left to catch up. Score ${s1}:${s2}. Player ${w} wins!`,

  }
};

function t(key, ...args) {
  const entry = I18N[currentLang][key];
  return typeof entry === 'function' ? entry(...args) : entry;
}

let lastStatusUpdater = () => t('statusStart');

function setGameStatus(updaterFn) {
  lastStatusUpdater = updaterFn;
  const el = document.getElementById('status');
  if (el) el.innerText = updaterFn();
}

function replaceTextNodes(root, matchWords, newText) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    if (matchWords.some(w => node.nodeValue.includes(w))) {
      node.nodeValue = newText;
    }
  }
}

function toggleLanguage() {
  currentLang = currentLang === 'ru' ? 'en' : 'ru';
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) langBtn.innerText = currentLang === 'ru' ? 'EN' : 'RU';

//  for (let key in COLORS_DATA) {
//    const btn = document.getElementById(`btn-${key}`);
//    if (btn) {
//      btn.innerText = `${I18N[currentLang].colors[key]} (${COLORS_DATA[key].val})`;
//    }
//  }

  replaceTextNodes(document.querySelector('.controls'), ['Купить шар', 'Buy ball'], `${t('buyLabel')} `);

  const resetBtn = document.querySelector('button[onclick="resetGame()"]');
  if (resetBtn) resetBtn.innerText = t('newGame');

  [1, 2].forEach(num => {
    const box = document.getElementById(`p${num}-box`);
    if (!box) return;
    replaceTextNodes(box, ['Игрок 1', 'Игрок 2', 'Player 1', 'Player 2'], t(`player${num}`));
    replaceTextNodes(box, ['Купленные цветные', 'Bought colors'], t('colorsLabel'));
  });

  const moveBtn = document.getElementById('btn-move-mode');
  if (moveBtn) moveBtn.innerText = t('moveBalls');

  if (typeof Multiplayer !== 'undefined' && typeof Multiplayer.refreshLang === 'function') {
    Multiplayer.refreshLang();
  }

  if (typeof RulesModal !== 'undefined' && typeof RulesModal.refreshLang === 'function') {
    RulesModal.refreshLang();
  }

  setGameStatus(lastStatusUpdater);
  if (typeof updateUI === 'function') updateUI();

}

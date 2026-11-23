/* =========================================================
   Школьная доска — кликабельный прототип (vanilla JS)
   Совместная работа имитируется между вкладками одного браузера:
   localStorage (состояние) + BroadcastChannel (живые штрихи).
   ========================================================= */
'use strict';
(function () {
  const BW = 1600, BH = 1000; // логический размер полотна
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  const DEMO_ID = 'true-false';
  const DEMO_IMG = 'ws-true-false';
  const DEMO_STUDENTS = [
    { pid: 'demo-anya', name: 'Аня', color: '#007AFF' },
    { pid: 'demo-misha', name: 'Миша', color: '#FF9500' },
  ];
  // Палитра рисования — яркие чистые цвета, отдельные от цветов интерфейса
  const PALETTE = [
    { c: '#1C1C1E', ru: 'Чёрный', en: 'Black' },
    { c: '#FF3B30', ru: 'Красный', en: 'Red' },
    { c: '#FF9500', ru: 'Оранжевый', en: 'Orange' },
    { c: '#FFCC00', ru: 'Жёлтый', en: 'Yellow' },
    { c: '#34C759', ru: 'Зелёный', en: 'Green' },
    { c: '#00C7BE', ru: 'Мятный', en: 'Mint' },
    { c: '#32ADE6', ru: 'Голубой', en: 'Cyan' },
    { c: '#007AFF', ru: 'Синий', en: 'Blue' },
    { c: '#AF52DE', ru: 'Фиолетовый', en: 'Purple' },
    { c: '#FF2D55', ru: 'Розовый', en: 'Pink' },
  ];
  const SIZES = { pen: [3, 6, 11], marker: [18, 30, 46], shape: [3, 6, 11], text: [26, 36, 52], eraser: [8, 16, 30] };
  const STAMP = 64;
  const STICKY = { w: 300, size: 26, pad: 20, minH: 150, bg: '#FFF2B3', ink: '#363052' };
  const CHECK_GREEN = '#006A46';
  const VIOLET = '#7563CA';
  const SEL_COLOR = '#9A8CE6'; // рамка выделения
  // Выделяются стрелкой только текст, стикеры и штампы; штрихи правятся ластиком, картинка закреплена
  const SELECTABLE = new Set(['text', 'sticky', 'stamp']);
  // Цвета букв для текста — короткий набор из палитры пера
  const TEXT_COLORS = ['#1C1C1E', '#FF3B30', '#FF9500', '#34C759', '#007AFF', '#AF52DE'];
  const TEACHER_RED = '#FF3B30';

  /* ---------------- i18n ---------------- */
  const plRu = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  const I18N = {
    ru: {
      appName: 'Интерактивная доска',
      homeTitle: 'Пространство для совместной работы',
      homeLead: 'Создайте доску и отправьте ученикам ссылку',
      boardTitle: 'Название доски', boardTitlePh: 'Например: English 6Б', defaultTitle: 'Урок {date}',
      taskLabel: 'Задание для учеников', optional: 'необязательно', taskHelp: 'Ученики увидят его на доске. Изменить можно в любой момент.',
      taskForStudents: 'Задание для учеников', taskSave: 'Сохранить', taskSaved: 'Задание обновлено у всех',
      taskPh: 'Например: обведите правильный ответ',
      create: 'Создать доску', createHelp: 'Сразу откроется новое полотно и ссылка-приглашение. Для следующего класса — новая доска той же кнопкой.',
      boardAuto: 'Доска · {date}', fileBase: 'доска',
      resultTitle: 'Вы можете сохранить эту доску', endedAt: 'Урок завершён', fileName: 'Имя файла',
      fileHelp: 'Расширение .png добавится автоматически. Файл можно переименовать и на компьютере.',
      deletesAt: 'Доска хранится в этом браузере до {time}. Если вы закроете сайт, она удалится при следующем открытии после этого времени. Скачанный файл останется у вас.',
      deleteBoard: 'Удалить доску', deleteTitle: 'Удалить доску?', deleteText: 'Удалятся загруженная картинка, все штрихи и итоговый лист. Скачанные PNG останутся у вас. Отменить удаление нельзя.',
      deletedTitle: 'Доска удалена', deletedText: 'Учитель удалил доску вместе с картинкой и пометками.',
      expiredTitle: 'Срок хранения истёк', expiredText: 'Доска удаляется через час после урока. Скачанные PNG сохранились у учителя.',
      lessonEndedTitle: 'Урок завершён', lessonEndedText: 'Доска закрыта, новые пометки добавить нельзя.',
      availableUntil: 'Скачать можно до {time} — потом доска удалится.',
      demoExpire: 'Демо: перемотать на час вперёд',
      demoTitle: 'Демо: True or False',
      demoText: 'Доска в середине упражнения: лист с заданием, два рукописных ответа и подчёркнутая учителем фраза.',
      demoOpen: 'Открыть демо',
      worksheetLink: 'Скачать учебный PNG для загрузки',
      recent: 'Недавние доски', statusActive: 'Идёт урок', statusEnded: 'Завершён',
      localNote: 'Прототип хранит доски в этом браузере. Ученика откройте во второй вкладке по ссылке-приглашению.',
      teacher: 'Учитель', student: 'Ученик', you: 'вы',
      studentsN: (n) => `${n} ${plRu(n, 'ученик', 'ученика', 'учеников')}`,
      participants: 'Участники', studentsOnBoard: 'Ученики на доске', copyLinkShort: 'Скопировать ссылку', noStudents: 'Пока никто не подключился. Отправьте ссылку-приглашение.',
      online: 'на доске',
      task: 'Задание', taskFromTeacher: 'Задание от учителя', noTask: 'Учитель не добавил текст задания.',
      eraseMine: 'Стереть мои записи', eraseMineTitle: 'Стереть все твои записи на доске?', eraseMineConfirm: 'Стереть', eraseMineDone: 'Твои записи стёрты',
      leave: 'Выйти', leaveTitle: 'Ты уверен, что хочешь выйти?', leftTitle: 'Вы вышли из сессии', leftText: 'Ваши записи остались на доске. Ссылка по-прежнему работает — можно войти снова.', react_fire: 'Огонь',
      invite: 'Пригласить', inviteTitle: 'Ссылка для учеников', copyManual: 'Выделите и скопируйте', moreActions: 'Ещё', colorThickness: 'Цвет и толщина',
      placeImage: 'Вставить',
      inviteText: 'Ученик откроет ссылку, введёт имя и сразу попадёт на доску. Ссылку можно открыть здесь в любой момент.',
      inviteDemo: 'Для демо откройте ссылку во второй вкладке этого браузера.',
      copyLink: 'Копировать ссылку', copied: 'Скопировано', copyFailed: 'Не получилось скопировать — выделите ссылку вручную',
      openTab: 'Открыть во вкладке', close: 'Закрыть', done: 'Готово',
      image: 'Изображение', uploadImage: 'Загрузить изображение', removeImage: 'Удалить изображение',
      removeImageTitle: 'Удалить изображение?', removeImageText: 'Пометки останутся на доске.',
      imageTypeError: 'Подойдёт только PNG или JPEG', imageAdded: 'Картинка закреплена под пометками',
      imageRemoved: 'Изображение удалено', restore: 'Вернуть', imageLoading: 'Загружаем изображение…',
      clear: 'Очистить доску', clearTitle: 'Очистить доску?',
      clearText: 'Изображение и все пометки будут удалены.',
      clearDone: 'Доска очищена',
      share: 'Поделиться результатом', shareShort: 'Поделиться',
      shareTitle: 'Результат сохранён', shareText: 'Снимок доски на {time}. Новые пометки в него не попадут.',
      shareDemo: 'Демо-ссылка открывается в этом браузере.',
      downloadPng: 'Скачать PNG', pngSaved: 'Скачан {name}',
      endLesson: 'Завершить', endTitle: 'Завершить сессию?',
      endText: 'Ученики больше не смогут рисовать, приглашение перестанет открывать доску. Вы увидите итоговый лист и сможете скачать PNG.',
      endConfirm: 'Завершить сессию', cancel: 'Отмена', remove: 'Удалить', clearConfirm: 'Очистить',
      endedBanner: 'Урок завершён', newBoard: 'Новая доска',
      thanksTitle: 'Спасибо! Урок завершён', thanksText: 'Итоговую доску можно скачать себе.',
      downloadFinal: 'Скачать итоговую доску',
      closedTitle: 'Сессия закрыта', closedText: 'Урок по этой ссылке уже завершён. Попросите у учителя новую ссылку.',
      notFoundTitle: 'Доска не найдена',
      notFoundText: 'В прототипе доски хранятся в браузере, где их создали. Откройте ссылку в том же браузере.',
      toHome: 'На стартовую',
      joinTitle: 'Вас пригласили в пространство для совместной работы', nameLabel: 'Ваше имя', namePh: 'Введите имя',
      join: 'Войти', nameRequired: 'Введите имя, чтобы войти',
      tool_select: 'Выделение', tool_pen: 'Перо', tool_marker: 'Маркер', tool_line: 'Линия',
      tool_arrow: 'Стрелка', tool_ellipse: 'Круг', tool_rect: 'Прямоугольник', tool_text: 'Текст',
      tool_stamp: 'Штампы', tool_eraser: 'Ластик', eraserSize: 'Размер ластика', tool_sticky: 'Стикер', stickyPh: 'Заметка',
      disconnect: 'Отключить {name}', disconnected: 'Ученик отключён: {name}', kickedTitle: 'Вы отключены от урока', kickedText: 'Учитель отключил вас от доски. Ссылка по-прежнему работает — можно войти снова.', rejoin: 'Войти снова',
      react_like: 'Лайк', react_smile: 'Улыбка', react_heart: 'Сердце', react_hundred: '100%', react_check: 'Галочка', textColor: 'Цвет текста', lessTools: 'Скрыть инструменты',
      undo: 'Отменить', redo: 'Повторить', tools: 'Инструменты', moreTools: 'Ещё инструменты',
      color: 'Цвет', thickness: 'Толщина', thin: 'Тонкая', medium: 'Средняя', thick: 'Толстая',
      editText: 'Редактировать', deleteEl: 'Удалить',
      notYours: 'Можно менять только свои пометки',
      joined: '{name} на доске',
      snapTitle: 'Снимок доски', snapSaved: 'Сохранено {time}', viewOnly: 'Только просмотр',
      snapFinal: 'Итог урока',
      snapNotFound: 'Снимок не найден', snapNotFoundText: 'Демо-ссылка на снимок работает в браузере, где снимок сохранён.',
      storageFull: 'В браузере закончилось место. Уберите старые доски или картинку поменьше.',
      textPh: 'Текст', lang: 'Язык интерфейса', preparing: 'Готовим демо…', home: 'Стартовая страница',
      teacherStart: 'Стартовая страница учителя',
    },
    en: {
      appName: 'Interactive Board',
      homeTitle: 'A space to work together',
      homeLead: 'Create a board and share the link with your students',
      boardTitle: 'Board title', boardTitlePh: 'e.g. English 6B', defaultTitle: 'Lesson {date}',
      taskLabel: 'Task for students', optional: 'optional', taskHelp: 'Students will see it on the board. You can change it any time.',
      taskForStudents: 'Task for students', taskSave: 'Save', taskSaved: 'Task updated for everyone',
      taskPh: 'For example: circle the correct answer',
      create: 'Create board', createHelp: 'A new canvas and invite link open right away. For your next class, create another board with the same button.',
      boardAuto: 'Board · {date}', fileBase: 'board',
      resultTitle: 'You can save this board', endedAt: 'Lesson finished', fileName: 'File name',
      fileHelp: 'The .png extension is added automatically. You can also rename the file on your computer.',
      deletesAt: 'The board is kept in this browser until {time}. If you close the site, it will be deleted the next time you open it after that time. Your downloaded file stays with you.',
      deleteBoard: 'Delete board', deleteTitle: 'Delete the board?', deleteText: 'The uploaded image, all strokes and the final sheet will be deleted. Downloaded PNGs stay with you. This can’t be undone.',
      deletedTitle: 'Board deleted', deletedText: 'The teacher deleted the board with its image and marks.',
      expiredTitle: 'Storage period has ended', expiredText: 'Boards are deleted one hour after the lesson. The teacher keeps any downloaded PNGs.',
      lessonEndedTitle: 'The lesson has ended', lessonEndedText: 'The board is closed — no new marks can be added.',
      availableUntil: 'You can download until {time} — then the board is deleted.',
      demoExpire: 'Demo: skip ahead one hour',
      demoTitle: 'Demo: True or False',
      demoText: 'A board mid-exercise: the worksheet, two handwritten answers and a phrase underlined by the teacher.',
      demoOpen: 'Open demo',
      worksheetLink: 'Download the worksheet PNG to upload',
      recent: 'Recent boards', statusActive: 'In progress', statusEnded: 'Ended',
      localNote: 'The prototype keeps boards in this browser. Open the student view in a second tab using the invite link.',
      teacher: 'Teacher', student: 'Student', you: 'you',
      studentsN: (n) => `${n} ${n === 1 ? 'student' : 'students'}`,
      participants: 'Participants', studentsOnBoard: 'Students on the board', copyLinkShort: 'Copy link', noStudents: 'No one has joined yet. Send the invite link.',
      online: 'on the board',
      task: 'Task', taskFromTeacher: 'From your teacher', noTask: 'The teacher has not added task text.',
      eraseMine: 'Erase my work', eraseMineTitle: 'Erase all your work on the board?', eraseMineConfirm: 'Erase', eraseMineDone: 'Your work has been erased',
      leave: 'Leave', leaveTitle: 'Are you sure you want to leave?', leftTitle: 'You left the session', leftText: 'Your work stays on the board. The link still works — you can join again.', react_fire: 'Fire',
      invite: 'Invite', inviteTitle: 'Link for students', copyManual: 'Select and copy', moreActions: 'More', colorThickness: 'Colour and thickness',
      placeImage: 'Insert',
      inviteText: 'Students open the link, enter a name and go straight to the board. You can reopen this link any time.',
      inviteDemo: 'For the demo, open the link in a second tab of this browser.',
      copyLink: 'Copy link', copied: 'Copied', copyFailed: 'Couldn’t copy — select the link manually',
      openTab: 'Open in a tab', close: 'Close', done: 'Done',
      image: 'Image', uploadImage: 'Upload image', removeImage: 'Remove image',
      removeImageTitle: 'Remove the image?', removeImageText: 'Marks will stay on the board.',
      imageTypeError: 'Only PNG or JPEG will work', imageAdded: 'Image pinned under the marks',
      imageRemoved: 'Image removed', restore: 'Undo', imageLoading: 'Uploading image…',
      clear: 'Clear board', clearTitle: 'Clear the board?',
      clearText: 'The image and all marks will be deleted.',
      clearDone: 'Board cleared',
      share: 'Share result', shareShort: 'Share',
      shareTitle: 'Result saved', shareText: 'Snapshot of the board at {time}. New marks won’t be added to it.',
      shareDemo: 'The demo link opens in this browser.',
      downloadPng: 'Download PNG', pngSaved: 'Downloaded {name}',
      endLesson: 'End', endTitle: 'End session?',
      endText: 'Students can no longer draw and the invite will stop opening the board. You’ll see the final sheet and can download a PNG.',
      endConfirm: 'End session', cancel: 'Cancel', remove: 'Remove', clearConfirm: 'Clear',
      endedBanner: 'Lesson ended', newBoard: 'New board',
      thanksTitle: 'Thank you! The lesson has ended', thanksText: 'You can download the final board.',
      downloadFinal: 'Download final board',
      closedTitle: 'Session closed', closedText: 'The lesson for this link has ended. Ask your teacher for a new link.',
      notFoundTitle: 'Board not found',
      notFoundText: 'In the prototype, boards live in the browser where they were created. Open the link in that browser.',
      toHome: 'Go to start page',
      joinTitle: 'You’ve been invited to a shared workspace', nameLabel: 'Your name', namePh: 'Enter your name',
      join: 'Join', nameRequired: 'Enter your name to join',
      tool_select: 'Select', tool_pen: 'Pen', tool_marker: 'Highlighter', tool_line: 'Line',
      tool_arrow: 'Arrow', tool_ellipse: 'Circle', tool_rect: 'Rectangle', tool_text: 'Text',
      tool_stamp: 'Stamps', tool_eraser: 'Eraser', eraserSize: 'Eraser size', tool_sticky: 'Sticky note', stickyPh: 'Note',
      disconnect: 'Disconnect {name}', disconnected: 'Student disconnected: {name}', kickedTitle: 'You’ve been disconnected', kickedText: 'Your teacher disconnected you from the board. The link still works — you can join again.', rejoin: 'Join again',
      react_like: 'Like', react_smile: 'Smile', react_heart: 'Heart', react_hundred: '100%', react_check: 'Check', textColor: 'Text colour', lessTools: 'Hide tools',
      undo: 'Undo', redo: 'Redo', tools: 'Tools', moreTools: 'More tools',
      color: 'Colour', thickness: 'Thickness', thin: 'Thin', medium: 'Medium', thick: 'Thick',
      editText: 'Edit', deleteEl: 'Delete',
      notYours: 'You can only change your own marks',
      joined: '{name} joined',
      snapTitle: 'Board snapshot', snapSaved: 'Saved {time}', viewOnly: 'View only',
      snapFinal: 'Lesson result',
      snapNotFound: 'Snapshot not found', snapNotFoundText: 'The demo snapshot link works in the browser where it was saved.',
      storageFull: 'The browser is out of space. Remove old boards or use a smaller image.',
      textPh: 'Text', lang: 'Interface language', preparing: 'Preparing the demo…', home: 'Start page',
      teacherStart: 'Teacher start page',
    },
  };
  // Язык интерфейса: ?lang= от платформы, с которой пришёл пользователь → язык этой вкладки → настройки демо
  // (localStorage wb:demo:lang; в прототипе его задаёт последний ?lang=). Переключателя RU/EN у ученика нет.
  const demoLang = () => { try { return localStorage.getItem('wb:demo:lang'); } catch (e) { return null; } };
  let lang = sessionStorage.getItem('wb:lang') || demoLang() || 'ru';
  document.documentElement.lang = lang;
  function setLang(l) { lang = l === 'en' ? 'en' : 'ru'; sessionStorage.setItem('wb:lang', lang); try { localStorage.setItem('wb:demo:lang', lang); } catch (e) { /* noop */ } document.documentElement.lang = lang; }
  function t(k, v) {
    let s = I18N[lang][k];
    if (s === undefined) s = I18N.ru[k];
    if (s === undefined) return k;
    if (typeof s === 'function') return s(v);
    if (v) s = s.replace(/\{(\w+)\}/g, (_, n) => (v[n] !== undefined ? v[n] : ''));
    return s;
  }

  /* ---------------- Icons: Lucide (ISC), контурные, 24×24, рисуются через currentColor ----------------
     Док: Undo2, Redo2, Pencil, MousePointer2, Eraser, Type, StickyNote, Smile. Размер и толщина — в CSS (.ic: 20 px, 1,75). */
  const P = {
    select: '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
    pen: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    marker: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    line: '<path d="M4 20 20 4"/>',
    arrow: '<path d="M5 19 19 5"/><path d="M9 5h10v10"/>',
    ellipse: '<circle cx="12" cy="12" r="8.5"/>',
    rect: '<rect x="3.5" y="5" width="17" height="14" rx="2"/>',
    text: '<path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/>',
    like: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    imageOff: '<path d="M2 2l20 20"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><path d="M13.5 13.5 6 21"/><path d="m18 12 3 3"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    flag: '<path d="M4 22V4"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    board: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 13c2-3 3.5 0 5-2.5S15 8.5 17 9.5"/><path d="m8 21 4-4 4 4"/>',
    task: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    party: '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98-.7.11-1.22.72-1.22 1.43V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
    edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    more: '<circle cx="12" cy="12" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    eraserAll: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    fit: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    pointer: '<path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    sticky: '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
    stamp: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
    confetti: '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98-.7.11-1.22.72-1.22 1.43V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  };
  // Подпись сразу на двух языках в одной ячейке: ширина = max(RU, EN), поэтому меню не прыгает при смене языка
  const L = (key, cls = '', vars) => `<span class="lbl-stack ${cls}">${['ru', 'en'].map((l) => {
    let v = I18N[l][key]; if (typeof v === 'function') v = v(vars); else if (vars) v = v.replace(/\{(\w+)\}/g, (_, n) => vars[n]);
    return `<span ${l === lang ? '' : 'aria-hidden="true" data-off'}>${esc(v)}</span>`; }).join('')}</span>`;
  const LM = (keys, active) => `<span class="lbl-stack">${keys.flatMap((k) => ['ru', 'en'].map((l) => `<span data-k="${k}" data-l="${l}" ${l === lang && k === active ? '' : 'aria-hidden="true" data-off'}>${esc(I18N[l][k])}</span>`)).join('')}</span>`;
  const icon = (n, cls = '') => `<svg class="ic ${cls}" data-icon="${n}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
  // Штампы — полноцветные эмодзи. Один и тот же символ в палитре, на доске и в PNG.
  // 💯 из палитры убран, но старые доски с ним рисуются как раньше.
  // check — зелёная галочка в светлом мятном квадрате со скруглением: рисуется вектором (CHECK_MARK) одинаково везде
  const REACTIONS = { like: '👍', heart: '❤️', check: '✅', smile: '🙂', fire: '🔥', hundred: '💯' };
  const REACTION_KINDS = ['like', 'heart', 'check', 'smile'];          // учитель
  const STUDENT_REACTION_KINDS = ['like', 'smile', 'heart', 'fire', 'check']; // ученик — набор шире
  const CHECK_MARK = { bg: '#DCF5E8', edge: '#B8E8CF', ink: '#14A05A', d: 'm7.2 12.4 3.3 3.3 6.4-7' };
  const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  const reactionHtml = (kind) => kind === 'check'
    ? `<svg class="react-check" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5.5" fill="${CHECK_MARK.bg}" stroke="${CHECK_MARK.edge}" stroke-width=".8"/><path d="${CHECK_MARK.d}" fill="none" stroke="${CHECK_MARK.ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<span class="react-emoji" aria-hidden="true">${REACTIONS[kind] || REACTIONS.like}</span>`;
  const path2dCache = new Map();
  const p2d = (d) => { if (!path2dCache.has(d)) path2dCache.set(d, new Path2D(d)); return path2dCache.get(d); };

  /* ---------------- Utils ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'ru-RU', { hour: '2-digit', minute: '2-digit' });
  const loc = (v) => (v && typeof v === 'object' ? v[lang] || v.ru || '' : v || '');
  function titleLines(b) {
    const when = `${new Date(b.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long' })}, ${new Date(b.createdAt).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    return { line1: [loc(b.subject), when].filter(Boolean).join(' · '), line2: loc(b.topic) };
  }
  const fmtDate = (ts) => new Date(ts).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long' });
  const baseUrl = () => location.origin + location.pathname;
  let zCounter = 0;
  const nextZ = () => Date.now() * 100 + (zCounter++ % 100);
  function colorForPid(pid) {
    const d = DEMO_STUDENTS.find((s) => s.pid === pid);
    if (d) return d.color;
    const cs = ['#007AFF', '#FF9500', '#34C759', '#AF52DE', '#00C7BE', '#FF2D55', '#32ADE6'];
    let h = 0; for (const ch of pid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return cs[h % cs.length];
  }
  const initials = (name) => (name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  /* ---------------- Storage ---------------- */
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast(t('storageFull'), 'info'); return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } },
    keys(prefix) { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) out.push(k); } return out; },
  };
  const K = {
    board: (id) => 'wb:board:' + id, img: (id) => 'wb:img:' + id, snap: (id) => 'wb:snap:' + id,
    pres: (b, p) => `wb:pres:${b}:${p}`, presPrefix: (b) => `wb:pres:${b}:`, boards: 'wb:boards', me: (b) => 'wb:me:' + b,
  };
  /* ---------------- Хранение: удаление через час после урока ---------------- */
  const AFTER_LESSON_MS = 60 * 60 * 1000;            // завершённый урок: 1 час
  const IDLE_MS = 30 * 24 * 60 * 60 * 1000;          // незавершённый: 30 дней после последнего изменения
  const goneKey = (id) => 'wb:gone:' + id;
  function expiresAt(b) {
    if (b.expireOverride) return b.expireOverride;
    return b.status === 'ended' ? b.endedAt + AFTER_LESSON_MS : (b.updatedAt || b.createdAt) + IDLE_MS;
  }
  // Удаляет картинки, штрихи и временный результат; оставляет только отметку «доска удалена»
  function deleteBoard(id, reason) {
    store.set(goneKey(id), { at: Date.now(), reason }); // сначала отметка — другие вкладки сразу покажут верный экран
    const b = store.get(K.board(id));
    if (b) {
      const imgs = new Set([...(b.imgIds || []), b.image && b.image.imgId].filter(Boolean));
      for (const sid of b.snapshots || []) { const sn = store.get(K.snap(sid)); if (sn && sn.image) imgs.add(sn.image.imgId); store.del(K.snap(sid)); }
      imgs.forEach((im) => { store.del(K.img(im)); IDB.del(im).catch(() => {}); imgCache.delete(im); });
    }
    store.keys(K.presPrefix(id)).forEach((k) => store.del(k));
    store.del(K.board(id));
    store.set(K.boards, (store.get(K.boards) || []).filter((x) => x !== id));
  }
  // Срок проверяется для ВСЕХ сохранённых в браузере досок (ключи wb:board:*), а не только для списка
  // последних 50 (wb:boards): доска, выпавшая из списка, тоже удаляется по сроку.
  // Запускается при каждом открытии сайта и переходе между экранами, а также раз в 15 секунд.
  function purgeExpired() {
    const gone = [];
    for (const key of store.keys(K.board(''))) {
      const id = key.slice(K.board('').length);
      const b = store.get(key);
      if (b && Date.now() >= expiresAt(b)) { deleteBoard(id, 'expired'); gone.push(id); }
    }
    return gone;
  }
  function addRecent(id) { const l = (store.get(K.boards) || []).filter((x) => x !== id); l.unshift(id); store.set(K.boards, l.slice(0, 50)); }

  /* ---------------- Images ---------------- */
  // Изображения хранятся в IndexedDB (место — сотни МБ, файл как есть); в localStorage только состояние доски.
  // Раньше изображения лежали в localStorage (лимит ~5 МБ на сайт) — при старте они переносятся сюда.
  const IDB = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('wb-images', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('images');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then((db) => new Promise((res, rej) => {
      const tr = db.transaction('images', mode); const req = fn(tr.objectStore('images'));
      tr.oncomplete = () => res(req && req.result); tr.onerror = () => rej(tr.error); tr.onabort = () => rej(tr.error);
    }));
    return { put: (id, blob) => tx('readwrite', (st) => st.put(blob, id)), get: (id) => tx('readonly', (st) => st.get(id)), del: (id) => tx('readwrite', (st) => st.delete(id)) };
  })();
  const dataUrlToBlob = async (u) => (await fetch(u)).blob();
  async function loadImageBlob(id) {
    let b = await IDB.get(id).catch(() => null);
    if (!b) {
      const legacy = localStorage.getItem(K.img(id));
      if (legacy) { b = await dataUrlToBlob(legacy); try { await IDB.put(id, b); localStorage.removeItem(K.img(id)); } catch (e) { /* noop */ } }
    }
    return b || null;
  }
  (async function migrateImages() { // освобождаем localStorage от старых изображений
    for (const k of store.keys('wb:img:')) {
      try { const b = await dataUrlToBlob(localStorage.getItem(k)); await IDB.put(k.slice(7), b); localStorage.removeItem(k); } catch (e) { /* noop */ }
    }
  })();
  const imgCache = new Map();
  function getImage(imgId, onload) {
    if (!imgId) return null;
    let e = imgCache.get(imgId);
    if (!e) {
      const im = new Image();
      e = { im, ready: false, cbs: [] };
      const fire = () => e.cbs.splice(0).forEach((f) => f());
      const fail = () => { imgCache.delete(imgId); fire(); }; // попробуем снова при следующей отрисовке
      im.onload = () => { e.ready = true; fire(); };
      im.onerror = fail;
      imgCache.set(imgId, e);
      loadImageBlob(imgId).then((b) => { if (b) im.src = URL.createObjectURL(b); else fail(); }).catch(fail);
    }
    if (!e.ready && onload) e.cbs.push(onload);
    return e.ready ? e.im : null;
  }
  const ensureImage = (imgId) => new Promise((res) => { if (!imgId) return res(); const im = getImage(imgId, res); if (im) res(); });
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const FIT_MARGIN = 40;
  function fitImage(imgId, w, h) {
    const s = Math.min((BW - FIT_MARGIN * 2) / w, (BH - FIT_MARGIN * 2) / h);
    const pw = w * s, ph = h * s;
    return { imgId, x: (BW - pw) / 2, y: (BH - ph) / 2, w: pw, h: ph, nw: w, nh: h };
  }
  function placeImage(imgId, w, h) {
    const s = Math.min(BW / w, BH / h);
    const pw = w * s, ph = h * s;
    return { imgId, x: (BW - pw) / 2, y: (BH - ph) / 2, w: pw, h: ph };
  }

  /* ---------------- Geometry & drawing ---------------- */
  const measureCtx = document.createElement('canvas').getContext('2d');
  function measureText(text, size) {
    measureCtx.font = `500 ${size}px ${FONT}`;
    const lines = String(text).split('\n');
    const w = Math.max(10, ...lines.map((l) => measureCtx.measureText(l || ' ').width));
    return { bw: w, bh: lines.length * size * 1.25 };
  }
  function wrapLines(text, maxW, size) {
    measureCtx.font = `500 ${size}px ${FONT}`;
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        const tryLine = line + word;
        if (measureCtx.measureText(tryLine).width <= maxW || !line.trim()) {
          if (measureCtx.measureText(tryLine).width > maxW && !line.trim()) { // слишком длинное слово — режем по буквам
            let chunk = '';
            for (const ch of word) { if (measureCtx.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ''; } chunk += ch; }
            line = chunk;
          } else line = tryLine;
        } else { out.push(line.trimEnd()); line = word.trimStart(); }
      }
      out.push(line.trimEnd());
    }
    return out;
  }
  function stickyHeight(text, w = STICKY.w, size = STICKY.size) {
    return Math.max(STICKY.minH, wrapLines(text || ' ', w - STICKY.pad * 2, size).length * size * 1.3 + STICKY.pad * 2);
  }
  function norm(el) { return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) }; }
  function bbox(el) {
    switch (el.type) {
      case 'pen': case 'marker': {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const p = el.pts;
        for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
        const r = el.sw / 2; return { x: x0 - r, y: y0 - r, w: x1 - x0 + 2 * r, h: y1 - y0 + 2 * r };
      }
      case 'line': case 'arrow': case 'rect': case 'ellipse': { const b = norm(el), r = el.sw / 2 + (el.type === 'arrow' ? 12 : 0); return { x: b.x - r, y: b.y - r, w: b.w + 2 * r, h: b.h + 2 * r }; }
      case 'text': return { x: el.x - 4, y: el.y - 4, w: el.bw + 8, h: el.bh + 8 };
      case 'sticky': return { x: el.x, y: el.y, w: el.w, h: el.h };
      case 'stamp': return { x: el.x - el.size / 2, y: el.y - el.size / 2, w: el.size, h: el.size };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  function distSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1; const l2 = dx * dx + dy * dy;
    let u = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; u = Math.max(0, Math.min(1, u));
    return Math.hypot(px - (x1 + u * dx), py - (y1 + u * dy));
  }
  function hitEl(el, x, y, tol, mode) {
    switch (el.type) {
      case 'pen': case 'marker': {
        const p = el.pts, r = el.sw / 2 + tol;
        if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= r;
        for (let i = 0; i < p.length - 2; i += 2) if (distSeg(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= r) return true;
        return false;
      }
      case 'line': case 'arrow': return distSeg(x, y, el.x1, el.y1, el.x2, el.y2) <= el.sw / 2 + tol;
      case 'rect': {
        const b = norm(el), r = el.sw / 2 + tol;
        const inside = x >= b.x - r && x <= b.x + b.w + r && y >= b.y - r && y <= b.y + b.h + r;
        if (!inside) return false;
        if (mode === 'select') return true;
        return x <= b.x + r || x >= b.x + b.w - r || y <= b.y + r || y >= b.y + b.h - r;
      }
      case 'ellipse': {
        const b = norm(el), rx = b.w / 2, ry = b.h / 2, cx = b.x + rx, cy = b.y + ry;
        if (rx < 2 || ry < 2) return distSeg(x, y, el.x1, el.y1, el.x2, el.y2) <= el.sw / 2 + tol;
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (mode === 'select' && d <= 1) return true;
        return Math.abs(d - 1) * Math.min(rx, ry) <= el.sw / 2 + tol;
      }
      case 'text': return x >= el.x - tol && x <= el.x + el.bw + tol && y >= el.y - tol && y <= el.y + el.bh + tol;
      case 'sticky': return x >= el.x - tol && x <= el.x + el.w + tol && y >= el.y - tol && y <= el.y + el.h + tol;
      case 'stamp': return Math.hypot(x - el.x, y - el.y) <= el.size / 2 + tol;
    }
    return false;
  }
  function translateEl(el, dx, dy) {
    const e = clone(el);
    if (e.pts) for (let i = 0; i < e.pts.length; i += 2) { e.pts[i] += dx; e.pts[i + 1] += dy; }
    if ('x1' in e) { e.x1 += dx; e.x2 += dx; e.y1 += dy; e.y2 += dy; }
    if (e.type === 'text' || e.type === 'stamp' || e.type === 'sticky') { e.x += dx; e.y += dy; }
    return e;
  }
  function strokePath(ctx, p) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    if (p.length === 4) { ctx.lineTo(p[2], p[3]); return; }
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
      ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
  }
  function drawEl(ctx, el) {
    ctx.save();
    ctx.strokeStyle = el.color; ctx.fillStyle = el.color;
    ctx.lineWidth = el.sw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (el.type) {
      case 'pen': case 'marker': {
        if (el.type === 'marker') { ctx.globalAlpha = 0.4; ctx.globalCompositeOperation = 'multiply'; }
        const p = el.pts;
        if (p.length === 2) { ctx.beginPath(); ctx.arc(p[0], p[1], el.sw / 2, 0, Math.PI * 2); ctx.fill(); }
        else { strokePath(ctx, p); ctx.stroke(); }
        break;
      }
      case 'line': ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke(); break;
      case 'arrow': {
        const a = Math.atan2(el.y2 - el.y1, el.x2 - el.x1), hl = Math.max(16, el.sw * 4);
        ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2);
        ctx.moveTo(el.x2 - hl * Math.cos(a - 0.5), el.y2 - hl * Math.sin(a - 0.5)); ctx.lineTo(el.x2, el.y2);
        ctx.lineTo(el.x2 - hl * Math.cos(a + 0.5), el.y2 - hl * Math.sin(a + 0.5));
        ctx.stroke(); break;
      }
      case 'rect': { const b = norm(el); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, Math.min(6, b.w / 2, b.h / 2)) : ctx.rect(b.x, b.y, b.w, b.h); ctx.stroke(); break; }
      case 'ellipse': { const b = norm(el); ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, Math.max(.5, b.w / 2), Math.max(.5, b.h / 2), 0, 0, Math.PI * 2); ctx.stroke(); break; }
      case 'text': {
        ctx.font = `500 ${el.size}px ${FONT}`; ctx.textBaseline = 'top';
        String(el.text).split('\n').forEach((l, i) => ctx.fillText(l, el.x, el.y + i * el.size * 1.25 + el.size * 0.08));
        break;
      }
      case 'sticky': {
        ctx.shadowColor = 'rgba(39,32,93,.14)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
        ctx.fillStyle = el.bg || STICKY.bg; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(el.x, el.y, el.w, el.h, 12); else ctx.rect(el.x, el.y, el.w, el.h);
        ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = el.color || STICKY.ink; ctx.font = `500 ${el.size}px ${FONT}`; ctx.textBaseline = 'top';
        wrapLines(el.text, el.w - STICKY.pad * 2, el.size).forEach((l, i) => ctx.fillText(l, el.x + STICKY.pad, el.y + STICKY.pad + i * el.size * 1.3));
        break;
      }
      case 'stamp': {
        if (el.kind === 'check') { // тот же рисунок, что в палитре (viewBox 24)
          const k = el.size * 0.9 / 20;
          ctx.translate(el.x - 12 * k, el.y - 12 * k); ctx.scale(k, k);
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(2, 2, 20, 20, 5.5); else ctx.rect(2, 2, 20, 20);
          ctx.fillStyle = CHECK_MARK.bg; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = CHECK_MARK.edge; ctx.stroke();
          ctx.lineWidth = 2.6; ctx.strokeStyle = CHECK_MARK.ink; ctx.stroke(p2d(CHECK_MARK.d));
          break;
        }
        // эмодзи вписываем в квадрат size×size по реальным границам глифа
        const ch = REACTIONS[el.kind] || REACTIONS.like, box = el.size * 0.9;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.font = `100px ${EMOJI_FONT}`;
        let m = ctx.measureText(ch);
        const gw = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || 100, gh = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 100;
        const fs = 100 * box / Math.max(gw, gh);
        ctx.font = `${fs}px ${EMOJI_FONT}`; m = ctx.measureText(ch);
        ctx.fillStyle = '#000';
        ctx.fillText(ch, el.x - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, el.y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
        break;
      }
    }
    ctx.restore();
  }
  // Сцена: белое полотно → картинка → пометки
  function drawScene(ctx, scene, opts = {}) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, BW, BH);
    if (scene.image) {
      const im = getImage(scene.image.imgId, opts.onImg);
      if (im) ctx.drawImage(im, scene.image.x, scene.image.y, scene.image.w, scene.image.h);
    }
    for (const el of scene.elements) { if (opts.hide && opts.hide.has(el.id)) continue; drawEl(ctx, el); }
  }
  async function renderPng(scene) {
    if (scene.image) await ensureImage(scene.image.imgId);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const k = 2, c = document.createElement('canvas'); c.width = BW * k; c.height = BH * k;
    const x = c.getContext('2d'); x.scale(k, k); drawScene(x, scene);
    return new Promise((r) => c.toBlob(r, 'image/png'));
  }
  // Имя файла по дате и времени: «доска-2026-11-22-19-58»; расширение .png добавляется само
  function defaultFileBase(ts) {
    const d = new Date(ts || Date.now()), p2 = (n) => String(n).padStart(2, '0');
    return `${t('fileBase')}-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}-${p2(d.getMinutes())}`;
  }
  function cleanFileBase(name, ts) {
    const b = String(name || '').trim().replace(/\.png$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^\.+/, '').slice(0, 80).trim();
    return b || defaultFileBase(ts);
  }
  async function downloadScene(scene, base) {
    const blob = await renderPng(scene);
    const name = cleanFileBase(base, scene.createdAt) + '.png';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(t('pngSaved', { name }), 'download');
    return name;
  }

  /* ---------------- UI primitives ---------------- */
  // Тост; с action — кнопка («Вернуть») и время подольше
  function toast(msg, ic = 'info', action) {
    const box = $('#toasts'); const el = document.createElement('div');
    el.className = 'toast' + (action ? ' has-action' : '');
    el.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>${action ? `<button class="toast-btn" type="button">${esc(action.label)}</button>` : ''}`;
    box.appendChild(el);
    const timer = setTimeout(() => el.remove(), action ? 6000 : 3000);
    if (action) el.querySelector('.toast-btn').addEventListener('click', () => { clearTimeout(timer); el.remove(); action.onClick(); });
    return el;
  }
  let modalClose = null;
  function openModal({ title, text, body = '', actions = [] }) {
    closeModal();
    const root = $('#modal-root');
    const prevFocus = document.activeElement;
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <h2 id="m-title">${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}${body}
      <div class="modal-actions">${actions.map((a, i) => `<button class="btn btn-lg ${a.kind || 'btn-ghost'}" data-i="${i}">${a.icon ? icon(a.icon) : ''}${esc(a.label)}</button>`).join('')}</div></div></div>`;
    const back = root.firstElementChild;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    back.addEventListener('click', (e) => {
      if (e.target === back) return closeModal();
      const b = e.target.closest('[data-i]'); if (!b) return;
      const a = actions[+b.dataset.i]; const keep = a.onClick && a.onClick() === false; if (!keep) closeModal();
    });
    document.addEventListener('keydown', onKey);
    modalClose = () => { document.removeEventListener('keydown', onKey); root.innerHTML = ''; modalClose = null; if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const primary = back.querySelector('.btn-primary, .btn-danger') || back.querySelector('.modal-actions .btn');
    if (primary) primary.focus();
    return back;
  }
  function closeModal() { if (modalClose) modalClose(); }
  function confirmModal({ title, text, confirm, danger, onConfirm }) {
    openModal({ title, text, actions: [{ label: t('cancel') }, { label: confirm, kind: danger ? 'btn-danger' : 'btn-primary', onClick: onConfirm }] });
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* noop */ } ta.remove(); return ok;
    }
  }
  function linkModal({ title, text, note, url, extra = [] }) {
    const back = openModal({
      title, text,
      body: `<div class="link-box"><input class="input" readonly value="${esc(url)}" aria-label="URL"><button class="btn btn-secondary" data-copy>${icon('copy')}${esc(t('copyLink'))}</button></div>
        ${note ? `<div class="hint" style="margin-top:12px">${icon('info')}<span>${esc(note)}</span></div>` : ''}`,
      actions: [...extra, { label: t('done'), kind: 'btn-primary' }],
    });
    const inp = back.querySelector('input');
    inp.addEventListener('focus', () => inp.select());
    back.querySelector('[data-copy]').addEventListener('click', async () => { const ok = await copyText(url); toast(ok ? t('copied') : t('copyFailed'), ok ? 'copy' : 'info'); if (!ok) inp.select(); });
  }
  function langSwitch() {
    return `<div class="lang" role="group" aria-label="${esc(t('lang'))}">
      <button type="button" data-lang="ru" aria-pressed="${lang === 'ru'}">RU</button>
      <button type="button" data-lang="en" aria-pressed="${lang === 'en'}">EN</button></div>`;
  }
  // Один общий обработчик переключения языка на весь документ (работает на любом экране)
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (!b || b.dataset.lang === lang) return; setLang(b.dataset.lang); route(); });
  function bindLang() { /* обработчик общий, см. выше */ }

  /* ---------------- Router ---------------- */
  let cleanup = null;
  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    closeModal();
    const raw = location.hash.slice(1) || '/';
    const [path, qs] = raw.split('?');
    const q = new URLSearchParams(qs || '');
    if (q.get('lang')) setLang(q.get('lang'));
    const parts = path.split('/').filter(Boolean);
    const app = $('#app');
    purgeExpired();
    if (parts[0] === 't' && parts[1]) cleanup = teacherRoute(app, parts[1]);
    else if (parts[0] === 'join' && parts[1]) cleanup = joinRoute(app, parts[1]);
    else if (parts[0] === 'demo') demoRoute(app, parts[1], q);
    else cleanup = homeRoute(app);
    document.title = t('appName');
  }
  window.addEventListener('hashchange', route);
  // Автоудаление проверяется раз в 15 секунд в каждой открытой вкладке
  setInterval(() => { const gone = purgeExpired(); if (gone.some((id) => location.hash.includes(id))) route(); }, 15000);

  // Переключателя RU/EN на экранах нет: язык приходит из платформы / настроек демо (langSw оставлен для отладки)
  function pageShell(inner, { brandLink = true, langSw = false, center = false } = {}) {
    return `<div class="page${center ? ' is-centered' : ''}"><header class="page-top">
      ${brandLink ? `<a class="brand" href="#/" aria-label="${esc(t('home'))}">` : '<div class="brand">'}<img class="brand-mark" src="brand-logo.png" width="44" height="32" alt="" decoding="async"><span>${esc(t('appName'))}</span>${brandLink ? '</a>' : '</div>'}
      ${langSw ? langSwitch() : ''}</header><main class="page-main" id="main">${inner}</main></div>`;
  }

  /* ---------------- Home (teacher start) ---------------- */
  function createBoard(task = '') {
    if (typeof task !== 'string') task = '';
    const id = uid(), now = Date.now();
    const board = { id, title: t('boardAuto', { date: fmtDate(now) + ', ' + fmtTime(now) }), task, status: 'active', createdAt: now, updatedAt: now, image: null, imgIds: [], elements: [], snapshots: [] };
    if (!store.set(K.board(id), board)) return;
    addRecent(id);
    sessionStorage.setItem('wb:justCreated', id);
    location.hash = '#/t/' + id;
  }
  /* ---------------- ShibaMascot: видео один раз → финальная поза (PNG) ----------------
     Видео и PNG лежат друг на друге в одной коробке с object-fit: contain, поэтому смена
     последнего кадра на PNG не меняет масштаб и положение. Ошибка загрузки, отказ автозапуска,
     видео без прозрачности (например, WebM в Safari) и prefers-reduced-motion → сразу PNG. */
  const ShibaMascot = {
    // Ролик проигрывается один раз; после окончания на экране остаётся его последний кадр (сам <video>).
    // shiba-last.png — тот же последний кадр (tools/shiba-last-frame.mjs) для запасного статичного режима.
    video: 'animations/shiba.webm',
    still: 'animations/shiba-last.png',
    html(cls = 'mascot') {
      if (!this.video) return `<div class="${cls} shiba is-still" aria-hidden="true"><img class="shiba-still" src="${this.still}" alt="" width="960" height="960" decoding="async"></div>`;
      return `<div class="${cls} shiba" aria-hidden="true">
        <img class="shiba-still" src="${this.still}" alt="" width="960" height="960" decoding="async">
        <video class="shiba-video" muted playsinline webkit-playsinline disablepictureinpicture disableremoteplayback preload="auto" tabindex="-1"></video>
      </div>`;
    },
    mount(root) {
      if (!root || !this.video) return () => {};
      const v = root.querySelector('.shiba-video'), img = root.querySelector('.shiba-still');
      let done = false;
      const showStill = () => {
        if (done) return; done = true;
        const swap = () => { root.classList.remove('is-playing'); root.classList.add('is-still'); requestAnimationFrame(() => { v.removeAttribute('src'); v.load(); }); };
        // сначала PNG готов к показу, потом убираем видео — без пустого кадра
        (img.complete ? Promise.resolve() : img.decode().catch(() => {})).then(swap);
      };
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { showStill(); return () => {}; }
      const guard = setTimeout(showStill, 6000); // видео так и не началось
      v.addEventListener('error', showStill);
      // Конец ролика: видео не убираем — остаётся его последний кадр
      v.addEventListener('ended', () => { clearTimeout(guard); done = true; root.classList.remove('is-playing'); root.classList.add('is-ended'); });
      v.addEventListener('loadeddata', () => {
        // если браузер проигрывает видео без альфа-канала, угол кадра будет непрозрачным → PNG
        try {
          const c = document.createElement('canvas'); c.width = c.height = 8;
          const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(v, 0, 0, 8, 8);
          if (g.getImageData(0, 0, 1, 1).data[3] > 200) { clearTimeout(guard); showStill(); return; }
        } catch (e) { /* noop */ }
        root.classList.add('is-playing');
        const p = v.play(); if (p && p.catch) p.catch(() => { clearTimeout(guard); showStill(); });
        clearTimeout(guard);
      }, { once: true });
      v.muted = true; v.loop = false; v.controls = false;
      v.src = this.video;
      return () => { clearTimeout(guard); v.removeAttribute('src'); v.load(); };
    },
  };

  function homeRoute(app) {
    app.innerHTML = pageShell(`<section class="card hero">
      ${ShibaMascot.html()}
      <h1>${esc(t('homeTitle'))}</h1>
      <p class="lead">${esc(t('homeLead'))}</p>
      <form id="create-form" class="hero-form" novalidate>
        <div class="field"><label for="f-task">${esc(t('taskLabel'))} <span class="optional">${esc(t('optional'))}</span></label>
          <textarea class="textarea" id="f-task" rows="2" maxlength="400" placeholder="${esc(t('taskPh'))}" aria-describedby="f-task-help"></textarea>
          <span class="help" id="f-task-help">${esc(t('taskHelp'))}</span></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('pencil')}${esc(t('create'))}</button>
      </form>
    </section>`, { langSw: false });
    bindLang(app);
    $('#create-form').addEventListener('submit', (e) => { e.preventDefault(); createBoard($('#f-task').value.trim()); });
    return ShibaMascot.mount($('.shiba', app)); // при уходе с экрана видео останавливается; при возврате — заново
  }

  /* ---------------- Demo seed: True or False, mid-exercise ---------------- */
  // Координаты квадратов на учебном PNG (worksheet/worksheet.html, 1600×1000)
  const TF_BOX = { x: 1388, size: 120, top: 262, step: 142 };
  function handStroke(points, jitter, seed) {
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1];
      const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 7));
      for (let k = 0; k < n; k++) { const u = k / n; out.push(+(x1 + (x2 - x1) * u + rnd() * jitter).toFixed(1), +(y1 + (y2 - y1) * u + rnd() * jitter).toFixed(1)); }
    }
    const [lx, ly] = points[points.length - 1]; out.push(lx, ly);
    return out;
  }
  function letterEls(letter, boxIndex, student, z0) {
    const cx = TF_BOX.x + TF_BOX.size / 2, cy = TF_BOX.top + boxIndex * TF_BOX.step + TF_BOX.size / 2;
    const strokes = letter === 'T'
      ? [[[cx - 33, cy - 34], [cx + 2, cy - 37], [cx + 34, cy - 35]], [[cx + 1, cy - 34], [cx - 1, cy + 4], [cx + 2, cy + 40]]]
      : [[[cx - 22, cy - 36], [cx - 23, cy + 2], [cx - 20, cy + 40]], [[cx - 22, cy - 36], [cx + 6, cy - 38], [cx + 32, cy - 36]], [[cx - 21, cy - 1], [cx + 20, cy + 1]]];
    return strokes.map((pts, i) => ({
      id: `seed-${student.pid}-${i}`, type: 'pen', color: student.color, sw: 7, pts: handStroke(pts, 1.6, 17 + i * 31 + boxIndex),
      author: student.pid, z: z0 + i,
    }));
  }
  async function seedDemo(reset) {
    if (!reset && store.get(K.board(DEMO_ID))) return true;
    let blob = await loadImageBlob(DEMO_IMG);
    if (!blob) {
      blob = await (await fetch('worksheet-true-false.png', { cache: 'no-store' })).blob();
      try { await IDB.put(DEMO_IMG, blob); } catch (e) { toast(t('storageFull')); return false; }
    }
    const blobUrl = URL.createObjectURL(blob); const im = await loadImg(blobUrl); URL.revokeObjectURL(blobUrl);
    const z = Date.now() * 100;
    const board = {
      id: DEMO_ID, title: 'English 6B · True or False',
      subject: { ru: 'Английский язык', en: 'English' }, topic: 'True or False',
      task: 'Read the text about Mia. Write T (true) or F (false) in the box with your number.',
      status: 'active', createdAt: Date.now(), updatedAt: Date.now(), imgIds: [DEMO_IMG],
      image: { ...placeImage(DEMO_IMG, im.naturalWidth, im.naturalHeight), locked: true },
      elements: [
        ...letterEls('F', 0, DEMO_STUDENTS[1], z), ...letterEls('T', 1, DEMO_STUDENTS[0], z + 10),
        { id: 'seed-teacher-underline', type: 'pen', color: TEACHER_RED, sw: 5, pts: handStroke([[100, 371], [290, 373], [478, 370]], 1.2, 7), author: 'teacher', z: z + 20 },
      ],
      snapshots: [],
    };
    store.del(goneKey(DEMO_ID));
    store.set(K.board(DEMO_ID), board);
    store.keys(K.presPrefix(DEMO_ID)).forEach((k) => store.del(k));
    histories.clear();
    addRecent(DEMO_ID);
    return true;
  }
  async function demoRoute(app, kind, q) {
    app.innerHTML = pageShell(`<section class="card center-card"><p class="lead" style="margin:0">${esc(t('preparing'))}</p></section>`, { langSw: false });
    const ok = await seedDemo(q.get('reset') === '1');
    if (!ok) return;
    if (kind === 'student') {
      const name = q.get('name') || DEMO_STUDENTS[0].name;
      const known = DEMO_STUDENTS.find((s) => s.name.toLowerCase() === name.toLowerCase() || s.pid === 'demo-' + name.toLowerCase());
      sessionStorage.setItem(K.me(DEMO_ID), JSON.stringify(known ? { pid: known.pid, name: known.name } : { pid: 's-' + uid(), name }));
      location.replace('#/join/' + DEMO_ID);
    } else location.replace('#/t/' + DEMO_ID);
  }

  /* ---------------- Join / ended / deleted / result ---------------- */
  function notFound(app, title = t('notFoundTitle'), text = t('notFoundText')) {
    app.innerHTML = pageShell(`<section class="card center-card"><div class="badge-ic">${icon('info')}</div><h1>${esc(title)}</h1><p class="lead">${esc(text)}</p>
      <a class="btn btn-secondary btn-lg" href="#/">${esc(t('toHome'))}</a></section>`);
    bindLang(app);
  }
  function goneView(app, id, asTeacher) {
    const g = store.get(goneKey(id));
    const manual = g && g.reason === 'manual';
    // статичная иллюстрация: шиба у корзины (PNG с прозрачностью; пропорции задают width/height)
    app.innerHTML = pageShell(`<section class="card center-card gone-card"><img class="gone-art" src="animations/shiba-deleted.png" width="520" height="489" alt="" decoding="async">
      <h1>${esc(manual ? t('deletedTitle') : t('expiredTitle'))}</h1><p class="lead">${esc(manual ? t('deletedText') : t('expiredText'))}</p>
      ${asTeacher ? `<button class="btn btn-primary btn-lg" id="create">${icon('pencil')}${esc(t('create'))}</button>` : ''}</section>`, { brandLink: asTeacher, center: true });
    bindLang(app);
    if (asTeacher) $('#create').addEventListener('click', createBoard);
  }
  function getMe(id) { try { return JSON.parse(sessionStorage.getItem(K.me(id)) || 'null'); } catch (e) { return null; } }
  function watchBoard(id) {
    // перерисовываем экран только когда доска удалена или сменился её статус — иначе пометки учителя
    // сбрасывали бы введённое имя и перезапускали шибу
    const st = (v) => { try { return v ? JSON.parse(v).status : null; } catch (e) { return null; } };
    const onStorage = (e) => { if (e.key === K.board(id) && st(e.newValue) !== st(e.oldValue)) route(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }
  function teacherRoute(app, id) {
    const b = store.get(K.board(id));
    if (!b) return store.get(goneKey(id)) ? goneView(app, id, true) : notFound(app);
    if (b.status === 'ended') return resultView(app, b);
    return boardView(app, id, 'teacher', { pid: 'teacher', name: t('teacher') });
  }
  function joinRoute(app, id) {
    const b = store.get(K.board(id));
    if (!b) return store.get(goneKey(id)) ? goneView(app, id, false) : notFound(app);
    const me = getMe(id);
    if (b.status === 'ended') return me ? thanksView(app, b) : endedView(app, b);
    if (me) return boardView(app, id, 'student', me);
    const left = sessionStorage.getItem('wb:left:' + id);
    if (sessionStorage.getItem('wb:kicked:' + id) || left) {
      app.innerHTML = pageShell(`<section class="card center-card"><div class="badge-ic">${icon(left ? 'logout' : 'users')}</div>
        <h1>${esc(t(left ? 'leftTitle' : 'kickedTitle'))}</h1><p class="lead">${esc(t(left ? 'leftText' : 'kickedText'))}</p>
        <button class="btn btn-primary btn-lg" id="rejoin">${esc(t('rejoin'))}</button></section>`, { brandLink: false });
      $('#rejoin').addEventListener('click', () => { sessionStorage.removeItem('wb:kicked:' + id); sessionStorage.removeItem('wb:left:' + id); route(); });
      return watchBoard(id);
    }
    // Шиба → заголовок → дата и время сессии → имя → «Войти». Без RU/EN: язык — из платформы / настроек демо
    app.innerHTML = pageShell(`<section class="card hero join-card">
      ${ShibaMascot.html('mascot mascot-sm')}
      <h1>${esc(t('joinTitle'))}</h1>
      <p class="join-when">${esc(fmtDate(b.createdAt) + ', ' + fmtTime(b.createdAt))}</p>
      <form id="join" class="hero-form" novalidate>
        <div class="field"><label for="f-name">${esc(t('nameLabel'))}</label>
          <input class="input" id="f-name" name="name" autocomplete="given-name" autocapitalize="words" enterkeyhint="go" placeholder="${esc(t('namePh'))}" maxlength="30" aria-describedby="f-name-err">
          <span class="error-text" id="f-name-err" role="alert"></span></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${esc(t('join'))}</button>
      </form></section>`, { brandLink: false, langSw: false });
    const inp = $('#f-name'), submit = $('#join [type="submit"]'), page = $('.page', app);
    setTimeout(() => inp.focus({ preventScroll: true }), 50);
    $('#join').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = inp.value.trim();
      if (!name) { inp.setAttribute('aria-invalid', 'true'); $('#f-name-err').textContent = t('nameRequired'); inp.focus(); return; }
      sessionStorage.setItem(K.me(id), JSON.stringify({ pid: 's-' + uid(), name }));
      route();
    });
    inp.addEventListener('input', () => { if (inp.value.trim()) { inp.removeAttribute('aria-invalid'); $('#f-name-err').textContent = ''; } });
    // Экранная клавиатура iPad уменьшает видимую область: компактный вид (без шибы) и поле с «Войти» в зоне видимости
    const vv = window.visualViewport;
    const fit = () => {
      const h = vv ? vv.height : window.innerHeight;
      page.classList.toggle('kb-compact', h < 560);
      if (document.activeElement === inp) requestAnimationFrame(() => submit.scrollIntoView({ block: 'nearest' }));
    };
    const offs = [];
    const listen = (tg, ev, fn) => { if (!tg) return; tg.addEventListener(ev, fn); offs.push(() => tg.removeEventListener(ev, fn)); };
    listen(vv, 'resize', fit); listen(window, 'resize', fit); listen(inp, 'focus', () => setTimeout(fit, 300));
    fit();
    const unmount = ShibaMascot.mount($('.shiba', app)), unwatch = watchBoard(id);
    return () => { offs.forEach((f) => f()); unmount(); if (typeof unwatch === 'function') unwatch(); };
  }
  // Приглашение после завершения урока — живая доска больше не открывается
  function endedView(app, b) {
    app.innerHTML = pageShell(`<section class="card center-card"><div class="badge-ic">${icon('lock')}</div>
      <h1>${esc(t('lessonEndedTitle'))}</h1><p class="lead" style="margin:0">${esc(t('lessonEndedText'))}</p></section>`, { brandLink: false });
    bindLang(app);
    return watchBoard(b.id);
  }
  const finalScene = (b) => (b.finalSnapshotId && store.get(K.snap(b.finalSnapshotId))) || { image: b.image, elements: b.elements, createdAt: b.endedAt };
  function thanksView(app, b) {
    const scene = finalScene(b);
    app.innerHTML = pageShell(`<section class="card center-card"><div class="badge-ic ok">${icon('party')}</div>
      <h1>${esc(t('thanksTitle'))}</h1><p class="lead" style="margin:0">${esc(t('thanksText'))}</p>
      <canvas class="thumb" aria-label="${esc(t('snapFinal'))}" role="img"></canvas>
      <button class="btn btn-primary btn-lg" id="dl">${icon('download')}${esc(t('downloadFinal'))}</button>
      <p class="help-line">${esc(t('availableUntil', { time: fmtTime(expiresAt(b)) }))}</p></section>`, { brandLink: false });
    bindLang(app);
    drawThumb($('.thumb'), scene);
    $('#dl').addEventListener('click', () => downloadScene(scene, defaultFileBase(b.endedAt)));
    return watchBoard(b.id);
  }
  function drawThumb(canvas, scene) {
    const draw = () => {
      const w = canvas.clientWidth || 480, dpr = window.devicePixelRatio || 1, s = w / BW;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * 0.625 * dpr);
      const ctx = canvas.getContext('2d'); ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
      drawScene(ctx, scene, { onImg: draw });
    };
    draw();
    return draw;
  }
  // Экран результата учителя: превью итогового листа, имя файла, скачивание, удаление
  function resultView(app, b) {
    const scene = finalScene(b);
    const exp = expiresAt(b);
    app.innerHTML = pageShell(`<section class="card result">
      <div class="result-preview"><canvas class="thumb" role="img" aria-label="${esc(t('snapFinal'))}"></canvas></div>
      <div class="result-side">
        <span class="status status-done">${icon('confetti')}<span>${esc(t('endedAt'))}</span></span>
        <h1>${esc(t('resultTitle'))}</h1>
        <p class="lead">${esc(fmtDate(b.endedAt) + ', ' + fmtTime(b.endedAt))}</p>
        <form id="dl-form" novalidate>
          <div class="field"><label for="f-file">${esc(t('fileName'))}</label>
            <div class="file-field"><input class="input" id="f-file" value="${esc(defaultFileBase(b.endedAt))}" autocomplete="off" spellcheck="false" aria-describedby="f-file-help"><span class="ext" aria-hidden="true">.png</span></div>
            <span class="help" id="f-file-help">${esc(t('fileHelp'))}</span></div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('download')}${esc(t('downloadPng'))}</button>
        </form>
        <div class="hint" style="margin-top:16px">${icon('info')}<span>${esc(t('deletesAt', { time: fmtTime(exp), date: fmtDate(exp) }))}</span></div>
        <div class="row" style="margin-top:16px">
          <button class="btn btn-danger-outline" id="del">${icon('trash')}${esc(t('deleteBoard'))}</button>
          <button class="btn btn-secondary" id="create">${icon('pencil')}${esc(t('newBoard'))}</button>
        </div>
      </div></section>`, { langSw: false });
    bindLang(app);
    const redraw = drawThumb($('.thumb'), scene);
    const ro = new ResizeObserver(() => redraw()); ro.observe($('.result-preview'));
    $('#dl-form').addEventListener('submit', async (e) => { e.preventDefault(); const inp = $('#f-file'); const name = await downloadScene(scene, inp.value); inp.value = name.replace(/\.png$/, ''); });
    $('#create').addEventListener('click', createBoard);
    $('#del').addEventListener('click', () => confirmModal({ title: t('deleteTitle'), text: t('deleteText'), confirm: t('deleteBoard'), danger: true,
      onConfirm: () => { deleteBoard(b.id, 'manual'); setTimeout(route, 0); } }));
    const off = watchBoard(b.id);
    return () => { ro.disconnect(); off(); };
  }

  /* ---------------- History (per board, per participant, per tab) ---------------- */
  const histories = new Map();
  function historyFor(boardId, pid) {
    const k = boardId + '|' + pid;
    if (!histories.has(k)) histories.set(k, { undo: [], redo: [] });
    return histories.get(k);
  }
  function applyOp(s, op, dir) {
    const add = dir > 0 ? op.added : op.removed;
    const rem = dir > 0 ? op.removed : op.added;
    const remIds = new Set(rem.map((e) => e.id));
    s.elements = s.elements.filter((e) => !remIds.has(e.id));
    for (const e of add) if (!s.elements.some((x) => x.id === e.id)) s.elements.push(clone(e));
    for (const [b, a] of op.changed) {
      const target = dir > 0 ? a : b;
      const i = s.elements.findIndex((x) => x.id === target.id);
      if (i >= 0) s.elements[i] = clone(target);
    }
    s.elements.sort((a, b) => a.z - b.z);
  }

  /* ---------------- Shared tool state (survives language switch) ---------------- */
  const ui = { tool: 'pen', colors: { marker: '#FFCC00', other: '#007AFF' }, size: 1, eraserSize: 1, stamp: 'like', flyout: false, more: false, taskOpenFor: new Set() };
  // Компактный док как во Freeform: перо и ластик всегда под рукой, остальное — за «Ещё»
  // MVP: только перо и ластик. Цвет и толщина — во всплывающей панели у пера
  // Перо (+ цвет и толщина), выделение, ластик, текст, стикер, штампы — у учителя и у ученика.
  // Ученик выделяет, двигает и правит только свои объекты, ластик стирает только его штрихи
  const TOOLS = [
    { id: 'pen', key: 'p', styled: true, primary: true }, { id: 'select', key: 'v' },
    { id: 'eraser', key: 'e', primary: true, fly: 'size' }, { id: 'text', key: 't' },
    { id: 'sticky', key: 's' }, { id: 'stamp', key: 'k', fly: 'react' },
  ];
  const flyKind = (tool) => { const x = TOOLS.find((q) => q.id === tool); return x ? (x.styled ? 'style' : x.fly || null) : null; };
  const isPrimary = (tool) => TOOLS.some((x) => x.id === tool && x.primary);
  const isStyled = (tool) => !!flyKind(tool);
  const colorFor = (tool) => (tool === 'marker' ? ui.colors.marker : ui.colors.other);
  const sizeFor = (tool) => (tool === 'marker' ? SIZES.marker : tool === 'pen' ? SIZES.pen : tool === 'text' ? SIZES.text : SIZES.shape)[ui.size];

  /* =========================================================
     Board view (teacher & student)
     ========================================================= */
  function boardView(app, boardId, role, me) {
    let board = store.get(K.board(boardId));
    const isTeacher = role === 'teacher';
    const H = historyFor(boardId, me.pid);
    const readOnly = board.status === 'ended';
    if (isTeacher) addRecent(boardId);
    const myColor = isTeacher ? VIOLET : colorForPid(me.pid);
    // Ученик по умолчанию пишет своим цветом — так пометки легко различать
    // Учитель — «красная ручка», ученик — свой цвет
    if (!ui.colorSet) { ui.colors.other = isTeacher ? TEACHER_RED : myColor; ui.colorSet = true; }

    const toolBtn = (x) => `<button class="tool" data-tool="${x.id}" aria-pressed="false" aria-label="${esc(t('tool_' + x.id))}" title="${esc(t('tool_' + x.id))} (${x.key.toUpperCase()})">${icon(x.id)}</button>`;
    const inviteUrl = `${baseUrl()}#/join/${boardId}`;
    const tl = titleLines(board);
    const myTools = TOOLS.filter((x) => isTeacher || !x.teacher);
    if (!myTools.some((x) => x.id === ui.tool)) ui.tool = 'pen';
    app.innerHTML = `<div class="board-app">
      <header class="topbar">
        <div class="tb-left">
          ${isTeacher ? `<a class="icon-btn glass" href="#/" aria-label="${esc(t('teacherStart'))}" title="${esc(t('teacherStart'))}">${icon('chevronLeft')}</a>` : ''}
          <div class="tb-title"><h1 title="${esc(tl.line1)}">${esc(tl.line1)}</h1>${tl.line2 ? `<div class="tb-sub" title="${esc(tl.line2)}">${esc(tl.line2)}</div>` : ''}</div>
        </div>
        <div class="tb-center">
          <div class="group glass">
            <div class="pop-anchor task-anchor">
              <button class="gbtn" data-action="task" aria-expanded="false" aria-controls="task-pop" aria-label="${esc(t('task'))}" title="${esc(t('task'))}">${icon('task')}${L('task')}<span class="new-dot" hidden aria-hidden="true"></span></button>
              <div class="popover task-pop" id="task-pop" hidden role="dialog" aria-label="${esc(t('task'))}">
                <div class="pop-head">${esc(isTeacher ? t('taskForStudents') : t('taskFromTeacher'))}</div>
                ${isTeacher ? `<form class="task-form" novalidate>
                    <label class="sr-only" for="task-edit">${esc(t('taskLabel'))}</label>
                    <textarea class="textarea" id="task-edit" rows="4" maxlength="400" placeholder="${esc(t('taskPh'))}">${esc(board.task || '')}</textarea>
                    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn-primary" type="submit">${esc(t('taskSave'))}</button></div>
                  </form>` : `<p class="task-text">${esc(board.task || t('noTask'))}</p>`}
              </div>
            </div>
            ${isTeacher ? `<button class="gbtn" data-action="image">${icon('image')}${LM(['uploadImage', 'removeImage'], 'uploadImage')}</button>
            <div class="pop-anchor">
              <button class="gbtn" data-action="invite" aria-expanded="false" aria-controls="invite-pop" aria-label="${esc(t('invite'))}" title="${esc(t('invite'))}">${icon('link')}${L('invite')}</button>
              <div class="popover invite-pop" id="invite-pop" hidden role="dialog" aria-labelledby="inv-title">
                <div class="pop-head" id="inv-title">${esc(t('inviteTitle'))}</div>
                <p class="pop-text">${esc(t('inviteText'))}</p>
                <input class="link-field" readonly value="${esc(inviteUrl)}" aria-label="${esc(t('inviteTitle'))}">
                <button class="btn btn-primary btn-block" data-copy-invite>${icon('copy')}<span class="copy-lbl">${esc(t('copyLink'))}</span></button>
              </div>
            </div>` : ''}
          </div>
        </div>
        <div class="tb-right">
          ${isTeacher ? (readOnly ? '' : `<button class="btn btn-side" data-action="clear" aria-label="${esc(t('clear'))}" title="${esc(t('clear'))}">${icon('trash')}${L('clear', 'lbl')}</button>
            <button class="btn btn-finish" data-action="end">${icon('flag')}${L('endLesson')}</button>`) : `<button class="btn btn-side btn-student" data-action="erase-mine" aria-label="${esc(t('eraseMine'))}" title="${esc(t('eraseMine'))}">${icon('eraserAll')}${L('eraseMine', 'lbl')}</button>
            <button class="btn btn-finish btn-student" data-action="leave">${icon('logout')}${L('leave')}</button>`}
        </div>
      </header>
      <main class="stage" id="main">
        ${readOnly ? '' : `<div class="dock glass" role="toolbar" aria-label="${esc(t('tools'))}">
          <button class="tool" data-action="undo" aria-label="${esc(t('undo'))}" title="${esc(t('undo'))} (⌘Z)">${icon('undo')}</button>
          <button class="tool" data-action="redo" aria-label="${esc(t('redo'))}" title="${esc(t('redo'))} (⇧⌘Z)">${icon('redo')}</button>
          <span class="dock-gap" aria-hidden="true"></span>
          ${myTools.map((x) => toolBtn(x) + (x.id === 'pen' ? `<button class="tool color-btn" data-action="color" aria-expanded="false" aria-label="${esc(t('colorThickness'))}" title="${esc(t('colorThickness'))}"><span class="color-dot" aria-hidden="true"></span></button>` : '')).join('')}
        </div>
        <div class="flyout" hidden role="group" aria-label="${esc(t('colorThickness'))}">
          <div class="fly-react"><div class="reactions" role="radiogroup" aria-label="${esc(t('tool_stamp'))}">${(isTeacher ? REACTION_KINDS : STUDENT_REACTION_KINDS).map((k) => `<button class="react-btn" data-react="${k}" role="radio" aria-checked="false" aria-label="${esc(t('react_' + k))}" title="${esc(t('react_' + k))}">${reactionHtml(k)}</button>`).join('')}</div></div>
          <div class="fly-color"><div class="fly-label" id="fl-color">${esc(t('color'))}</div>
          <div class="swatches" role="radiogroup" aria-labelledby="fl-color">${PALETTE.map((p) => `<button class="swatch" data-color="${p.c}" role="radio" aria-checked="false" aria-label="${esc(p[lang])}" title="${esc(p[lang])}"><span style="background:${p.c}"></span></button>`).join('')}</div></div>
          <div class="fly-size"><div class="fly-label" id="fl-size">${esc(t('thickness'))}</div>
          <div class="widths" role="radiogroup" aria-labelledby="fl-size">${['thin', 'medium', 'thick'].map((n, i) => `<button class="width-btn" data-size="${i}" role="radio" aria-checked="false" aria-label="${esc(t(n))}" title="${esc(t(n))}"><span style="width:${[18, 22, 26][i]}px;height:${[3, 6, 11][i]}px"></span></button>`).join('')}</div></div>
        </div>`}
        <div class="pop-anchor people-dock">
          <button class="people-btn glass" data-action="people" aria-expanded="false" aria-controls="people-pop">${icon('users')}<span class="people-count" aria-hidden="true"></span></button>
          <div class="popover up people-pop" id="people-pop" hidden role="dialog" aria-labelledby="pp-title">
            <div class="pp-head"><span class="pop-head" id="pp-title">${esc(t('studentsOnBoard'))}</span><span class="pp-count" aria-hidden="true"></span></div>
            <ul class="people-list" aria-live="polite"></ul>
            ${isTeacher ? `<div class="pp-foot"><button class="btn btn-quiet btn-block" data-copy-link>${icon('copy')}<span class="copy-lbl">${esc(t('copyLinkShort'))}</span></button></div>` : ''}
          </div>
        </div>
        <div class="frame ${readOnly ? 'readonly' : ''}"><canvas class="base" aria-hidden="true"></canvas><canvas class="live" role="img" aria-label="${esc(board.title)}"></canvas><div class="overlay"></div></div>
        ${readOnly ? `<div class="ended-banner"><strong><span class="ok">${icon('check')}</span>${esc(t('endedBanner'))}</strong>
          <button class="btn btn-ghost" data-action="open-final">${icon('external')}${esc(t('openResult'))}</button>
          <button class="btn btn-primary" data-action="dl-final">${icon('download')}${esc(t('downloadPng'))}</button>
          <a class="btn btn-ghost" href="#/">${esc(t('newBoard'))}</a></div>` : ''}
        ${isTeacher && !readOnly ? `<div class="place-bar glass" hidden role="toolbar" aria-label="${esc(t('uploadImage'))}">
          <button class="btn btn-neutral" data-img="cancel">${esc(t('cancel'))}</button>
          <button class="btn btn-primary" data-img="place">${icon('check')}${esc(t('placeImage'))}</button>
        </div>` : ''}
      </main>
      <input type="file" accept="image/png,image/jpeg" hidden id="file">
    </div>`;

    const stage = $('.stage', app), frame = $('.frame', app), overlay = $('.overlay', app);
    const base = $('canvas.base', app), live = $('canvas.live', app);
    const bctx = base.getContext('2d');
    const lctx = live.getContext('2d', { desynchronized: true });
    const flyout = $('.flyout', app), toolsEl = $('.dock', app);
    let scale = 1, dpr = window.devicePixelRatio || 1;
    let draft = null, drag = null, selectedId = null, editor = null, erasing = null, lastTap = { t: 0, id: null }, imgPreview = null;
    const remote = new Map(); // pid -> { el, name, color, tagEl }
    const disposers = [];
    const on = (target, ev, fn, opt) => { target.addEventListener(ev, fn, opt); disposers.push(() => target.removeEventListener(ev, fn, opt)); };
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('wb:' + boardId) : null;

    const canModify = (el) => isTeacher || el.author === me.pid;

    /* ---------- Layout ---------- */
    function layout() {
      const r = stage.getBoundingClientRect();
      const left = 20, right = 20, top = readOnly ? 76 : 16, bottom = readOnly ? 20 : 92;
      const aw = r.width - left - right, ah = r.height - top - bottom;
      scale = Math.max(0.1, Math.min(aw / BW, ah / BH));
      const fw = BW * scale, fh = BH * scale;
      dpr = window.devicePixelRatio || 1;
      Object.assign(frame.style, { width: fw + 'px', height: fh + 'px', left: left + (aw - fw) / 2 + 'px', top: top + (ah - fh) / 2 + 'px' });
      for (const c of [base, live]) { c.width = Math.round(fw * dpr); c.height = Math.round(fh * dpr); }
      renderBase(); renderLive(); positionFlyout(); updateSelBar(); positionEditor(); updateImageEditor();
      if (typeof fitKeyboard === 'function') fitKeyboard();
    }
    /* ---------- Rendering ---------- */
    let baseQueued = false;
    const scheduleBase = () => { if (baseQueued) return; baseQueued = true; requestAnimationFrame(() => { baseQueued = false; renderBase(); }); };
    function renderBase() {
      bctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      const hide = new Set();
      if (drag && drag.moved) hide.add(drag.id);
      if (editor && editor.el) hide.add(editor.el.id);
      const sceneImg = imgPreview || (board.image && (isTeacher || board.image.locked) ? board.image : null);
      drawScene(bctx, { ...board, image: sceneImg }, { hide, onImg: scheduleBase });
    }
    function renderLive() {
      lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, live.width, live.height);
      lctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      for (const r of remote.values()) if (r.el) drawEl(lctx, r.el);
      if (draft) drawEl(lctx, draft);
      if (drag && drag.moved) drawEl(lctx, drag.preview);
      if (erasing) { lctx.save(); lctx.strokeStyle = 'rgba(39,32,93,.55)'; lctx.fillStyle = 'rgba(235,235,244,.45)'; lctx.lineWidth = 1.5 / scale; lctx.beginPath(); lctx.arc(erasing.x, erasing.y, SIZES.eraser[ui.eraserSize], 0, Math.PI * 2); lctx.fill(); lctx.stroke(); lctx.restore(); }
      const sel = selectedId && (drag && drag.moved ? drag.preview : board.elements.find((e) => e.id === selectedId));
      if (sel) {
        const b = bbox(sel);
        // тонкая сиреневая рамка — только на живом слое, в PNG не попадает
        const pad = 6 / scale + (sel.type === 'stamp' ? 0 : 2);
        lctx.save(); lctx.strokeStyle = SEL_COLOR; lctx.lineWidth = 1.5 / scale; lctx.beginPath();
        if (lctx.roundRect) lctx.roundRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, 8 / scale); else lctx.rect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
        lctx.stroke(); lctx.restore();
      }
      updateTags();
    }
    function updateTags() {
      for (const [pid, r] of remote) {
        if (!r.el) { if (r.tagEl) { r.tagEl.remove(); r.tagEl = null; } continue; }
        if (!r.tagEl) { r.tagEl = document.createElement('div'); r.tagEl.className = 'name-tag'; r.tagEl.textContent = r.name; r.tagEl.style.background = r.color; overlay.appendChild(r.tagEl); }
        const pt = tipOf(r.el);
        r.tagEl.style.left = pt[0] * scale + 'px'; r.tagEl.style.top = pt[1] * scale + 'px';
      }
    }
    function tipOf(el) { if (el.pts) return [el.pts[el.pts.length - 2], el.pts[el.pts.length - 1]]; if ('x2' in el) return [el.x2, el.y2]; return [el.x, el.y]; }

    /* ---------- State sync ---------- */
    function mutate(fn) {
      const s = store.get(K.board(boardId));
      if (!s || s.status === 'ended') { route(); return false; }
      fn(s); s.updatedAt = Date.now();
      if (!store.set(K.board(boardId), s)) return false;
      board = s; scheduleBase(); renderLive(); updateImageBtn(); updateImageEditor();
      return true;
    }
    function commit(op) {
      if (!mutate((s) => applyOp(s, op, 1))) return;
      H.undo.push(op); H.redo.length = 0; if (H.undo.length > 100) H.undo.shift(); updateHistoryBtns();
    }
    function pushHistory(op) { H.undo.push(op); H.redo.length = 0; updateHistoryBtns(); }
    function undo() { const op = H.undo.pop(); if (!op) return; mutate((s) => applyOp(s, op, -1)); H.redo.push(op); deselect(); updateHistoryBtns(); }
    function redo() { const op = H.redo.pop(); if (!op) return; mutate((s) => applyOp(s, op, 1)); H.undo.push(op); updateHistoryBtns(); }
    function updateHistoryBtns() {
      const u = $('[data-action="undo"]', app), r = $('[data-action="redo"]', app);
      if (u) u.disabled = !H.undo.length; if (r) r.disabled = !H.redo.length;
    }
    function syncTask(prev) {
      const anchor = $('.task-anchor', app); if (!anchor || isTeacher) return;
      const p = $('.task-text', app); if (p) p.textContent = board.task || t('noTask');
      if (prev !== undefined && prev !== board.task && board.task && $('#task-pop', app).hidden) $('.new-dot', app).hidden = false;
    }
    on(window, 'storage', (e) => {
      if (e.key === K.board(boardId)) {
        if (!e.newValue) return route();
        const nb = JSON.parse(e.newValue);
        const prevTask = board.task;
        setTimeout(() => syncTask(prevTask), 0);
        const statusChanged = nb.status !== board.status;
        board = nb;
        if (!isTeacher && (nb.kicked || []).includes(me.pid)) { sessionStorage.removeItem(K.me(boardId)); sessionStorage.setItem('wb:kicked:' + boardId, '1'); return route(); }
        if (isTeacher) renderPeople();
        if (statusChanged) return route();
        if (selectedId && !board.elements.some((x) => x.id === selectedId)) deselect();
        for (const [pid, r] of remote) if (r.el && board.elements.some((x) => x.id === r.el.id)) { r.el = null; }
        scheduleBase(); renderLive(); updateImageBtn(); updateImageEditor();
      } else if (e.key && e.key.startsWith(K.presPrefix(boardId))) renderPeople();
    });
    if (bc) {
      bc.onmessage = (ev) => {
        const m = ev.data; if (!m || m.pid === me.pid) return;
        const r = remote.get(m.pid) || { name: m.name, color: m.color };
        r.name = m.name; r.color = m.color;
        if (m.t === 'draft') r.el = m.el;
        else if (m.t === 'end') r.el = null;
        remote.set(m.pid, r); renderLive();
      };
      disposers.push(() => bc.close());
    }
    let bcQueued = false;
    function broadcastDraft() {
      if (!bc || bcQueued) return; bcQueued = true;
      requestAnimationFrame(() => { bcQueued = false; if (draft) bc.postMessage({ t: 'draft', pid: me.pid, name: me.name, color: draft.color, el: draft }); });
    }
    const broadcastEnd = () => bc && bc.postMessage({ t: 'end', pid: me.pid, name: me.name });

    /* ---------- Presence ---------- */
    const presKey = K.pres(boardId, me.pid);
    const beat = () => store.set(presKey, { name: me.name, role, t: Date.now() });
    if (!readOnly || isTeacher) { beat(); const iv = setInterval(beat, 4000); disposers.push(() => clearInterval(iv)); }
    const leave = () => store.del(presKey);
    on(window, 'pagehide', leave);
    disposers.push(leave);
    function participants() {
      const now = Date.now(), kicked = new Set(board.kicked || []);
      return store.keys(K.presPrefix(boardId)).map((k) => ({ pid: k.slice(K.presPrefix(boardId).length), ...store.get(k) }))
        .filter((p) => p && p.t && now - p.t < 60000 && !kicked.has(p.pid));
    }
    const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let shownCount = null;
    function personRow(p) {
      const li = document.createElement('li'); li.dataset.pid = p.pid;
      li.innerHTML = `<span class="avatar" style="background:${colorForPid(p.pid)}">${esc(initials(p.name))}</span><span class="pname">${esc(p.name)}</span>${p.pid === me.pid ? `<span class="tag">${esc(t('you'))}</span>` : ''}${isTeacher ? `<button class="kick-btn" data-kick="${esc(p.pid)}" data-name="${esc(p.name)}" aria-label="${esc(t('disconnect', { name: p.name }))}" title="${esc(t('disconnect', { name: p.name }))}">${icon('x', 'ic-sm')}</button>` : ''}`;
      return li;
    }
    function renderPeople() {
      const students = participants().filter((p) => p.role === 'student');
      const n = students.length, btn = $('.people-btn', app), pop = $('#people-pop', app), ul = $('.people-list', app);
      const open = !pop.hidden;
      // число
      const cnt = $('.people-count', app);
      if (shownCount !== null && n !== shownCount && !open && !reduceMotion()) { cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump'); cnt.addEventListener('animationend', () => cnt.classList.remove('bump'), { once: true }); }
      cnt.textContent = String(n); $('.pp-count', app).textContent = String(n); shownCount = n;
      btn.setAttribute('aria-label', `${t('studentsOnBoard')}: ${t('studentsN', n)}`); btn.title = t('studentsN', n);
      // строки: добавляем новые, убираем ушедших, остальные не трогаем
      const want = new Map(students.map((p) => [p.pid, p]));
      ul.querySelectorAll('li.empty').forEach((e) => { if (n) e.remove(); });
      ul.querySelectorAll('li[data-pid]:not(.leaving)').forEach((li) => {
        if (want.has(li.dataset.pid)) return;
        if (!open || reduceMotion()) { li.remove(); return; }
        li.classList.add('leaving'); setTimeout(() => li.remove(), 260);
      });
      for (const p of students) {
        if (ul.querySelector(`li[data-pid="${CSS.escape(p.pid)}"]:not(.leaving)`)) continue;
        const li = personRow(p);
        if (open && !reduceMotion()) li.classList.add('entering');
        ul.appendChild(li);
      }
      if (!n && !ul.querySelector('li.empty')) ul.insertAdjacentHTML('beforeend', `<li class="empty">${esc(t('noStudents'))}</li>`);
    }
    function openPeople(btn) {
      const pop = $('#people-pop', app);
      togglePop(btn, pop);
      if (!pop.hidden) $('.people-list', app).querySelectorAll('li').forEach((li, i) => { li.classList.remove('entering'); li.style.setProperty('--i', i); });
    }
    renderPeople();
    const pv = setInterval(renderPeople, 5000); disposers.push(() => clearInterval(pv));

    /* ---------- Popovers ---------- */
    function togglePop(btn, pop, force) {
      const open = force !== undefined ? force : pop.hidden;
      app.querySelectorAll('.popover').forEach((p) => { if (p !== pop) p.hidden = true; });
      app.querySelectorAll('.pop-anchor > [aria-expanded]').forEach((b) => { if (b !== btn) b.setAttribute('aria-expanded', 'false'); });
      pop.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    }
    function closePops() {
      app.querySelectorAll('.popover').forEach((p) => { p.hidden = true; });
      app.querySelectorAll('.pop-anchor > [aria-expanded]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    }
    on(document, 'pointerdown', (e) => {
      if (!e.target.closest('.pop-anchor') && !e.target.closest('canvas.live')) closePops();
      // Касание вне палитры закрывает её
      if (ui.flyout && !e.target.closest('.flyout') && !e.target.closest('.dock') && !e.target.closest('canvas.live')) { ui.flyout = false; syncToolbar(); }
    });
    // Ученику один раз показываем задание при входе
    if (!isTeacher && board.task && !ui.taskOpenFor.has(boardId)) {
      ui.taskOpenFor.add(boardId);
      setTimeout(() => togglePop($('[data-action="task"]', app), $('#task-pop', app), true), 300);
    }

    /* ---------- Toolbar & flyout ---------- */
    function setTool(tool, { openFly = true } = {}) {
      if (editor) commitEditor();
      if (tool !== 'select') deselect();
      const same = ui.tool === tool;
      ui.tool = tool; frame.dataset.tool = tool; live.style.cursor = '';
      ui.flyout = isStyled(tool) ? (same ? !ui.flyout : (tool === 'stamp' || openFly)) : false;
      syncToolbar();
    }
    function syncToolbar() {
      if (!toolsEl) return;
      toolsEl.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === ui.tool)));
      const cb = toolsEl.querySelector('.color-btn');
      cb.querySelector('.color-dot').style.background = ui.colors.other;
      const sb = toolsEl.querySelector('[data-tool="stamp"]'); if (sb) sb.setAttribute('aria-expanded', String(!!ui.flyout && ui.tool === 'stamp'));
      flyout.querySelectorAll('[data-react]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.react === ui.stamp)));
      const kind = flyKind(ui.tool);
      flyout.hidden = !ui.flyout || !kind;
      flyout.dataset.mode = kind || '';
      cb.setAttribute('aria-expanded', String(!flyout.hidden && kind === 'style'));
      flyout.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === ui.colors.other)));
      const sz = ui.tool === 'eraser' ? ui.eraserSize : ui.size;
      flyout.querySelector('#fl-size').textContent = ui.tool === 'eraser' ? t('eraserSize') : t('thickness');
      flyout.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.size === sz)));
      positionFlyout();
    }
    function positionFlyout() {
      if (!flyout || flyout.hidden) return;
      const btn = ui.tool === 'eraser' ? toolsEl.querySelector('[data-tool="eraser"]') : ui.tool === 'stamp' ? toolsEl.querySelector('[data-tool="stamp"]') : toolsEl.querySelector('.color-btn');
      const sr = stage.getBoundingClientRect(), br = btn.getBoundingClientRect(), tr = toolsEl.getBoundingClientRect();
      const fw = flyout.offsetWidth || 240, fh = flyout.offsetHeight || 200;
      const cx = br.left - sr.left + br.width / 2;
      const left = Math.max(8, Math.min(cx - fw / 2, sr.width - fw - 8));
      flyout.style.left = left + 'px'; flyout.style.top = tr.top - sr.top - fh - 10 + 'px';
      flyout.style.transformOrigin = `${cx - left}px 100%`;
      flyout.style.setProperty('--arrow-x', Math.max(14, Math.min(fw - 26, cx - left - 6)) + 'px');
    }
    if (toolsEl) {
      on(toolsEl, 'click', (e) => { const b = e.target.closest('[data-tool]'); if (b) setTool(b.dataset.tool); });
      on(flyout, 'click', (e) => {
        const c = e.target.closest('[data-color]'), sz = e.target.closest('[data-size]'), rc = e.target.closest('[data-react]');
        if (rc) { ui.stamp = rc.dataset.react; ui.flyout = false; } // после выбора палитра закрывается
        if (c) {
          ui.colors.other = c.dataset.color; // только цвет пера; цвет выделенного текста — в панели выделения
        }
        if (sz) { if (ui.tool === 'eraser') ui.eraserSize = +sz.dataset.size; else ui.size = +sz.dataset.size; }
        syncToolbar();
      });
      frame.dataset.tool = ui.tool;
      syncToolbar(); updateHistoryBtns();
    }

    /* ---------- Teacher actions ---------- */
    // Одна кнопка: «Загрузить изображение» ↔ «Удалить изображение» (после подтверждённой вставки)
    function updateImageBtn() {
      const b = $('[data-action="image"]', app); if (!b) return;
      const placed = !!(board.image && board.image.locked);
      const key = placed ? 'removeImage' : 'uploadImage';
      b.dataset.mode = placed ? 'remove' : 'upload';
      b.querySelector('svg').outerHTML = icon(placed ? 'imageOff' : 'image');
      b.querySelectorAll('[data-k]').forEach((sp) => { const on = sp.dataset.k === key && sp.dataset.l === lang; if (on) { sp.removeAttribute('data-off'); sp.removeAttribute('aria-hidden'); } else { sp.setAttribute('data-off', ''); sp.setAttribute('aria-hidden', 'true'); } });
      b.disabled = !!board.image && !placed; // во время предпросмотра
      b.setAttribute('aria-label', t(key)); b.title = t(key);
    }
    // Новая картинка: расположить (перетащить, потянуть за угол) → «Разместить». После этого её можно только удалить
    let imgBox = null, imgDrag = null;
    const placeBar = $('.place-bar', app);
    if (placeBar) {
      on(placeBar, 'click', (e) => {
        const b = e.target.closest('[data-img]'); if (!b || !board.image) return;
        const k = b.dataset.img;
        if (k === 'place') mutate((s) => { if (s.image) s.image.locked = true; });
        else if (k === 'cancel') mutate((s) => { s.image = null; });
      });
    }
    function updateImageEditor() {
      const im = imgPreview || board.image;
      const previewing = isTeacher && !readOnly && !!im && !(board.image && board.image.locked);
      if (placeBar) placeBar.hidden = !previewing;
      if (toolsEl) toolsEl.hidden = previewing;
      if (previewing && ui.flyout) { ui.flyout = false; syncToolbar(); }
      if (!previewing) { if (imgBox) { imgBox.remove(); imgBox = null; } return; }
      if (!imgBox) {
        imgBox = document.createElement('div'); imgBox.className = 'img-box';
        imgBox.innerHTML = ['nw', 'ne', 'sw', 'se'].map((h) => `<span class="img-handle h-${h}" data-handle="${h}" aria-hidden="true"></span>`).join('');
        overlay.appendChild(imgBox);
        imgBox.addEventListener('pointerdown', onImgDown);
      }
      Object.assign(imgBox.style, { left: im.x * scale + 'px', top: im.y * scale + 'px', width: im.w * scale + 'px', height: im.h * scale + 'px' });
    }
    function onImgDown(ev) {
      if (!board.image || board.image.locked) return;
      ev.preventDefault(); ev.stopPropagation();
      imgBox.setPointerCapture(ev.pointerId);
      const [x, y] = toBoard(ev);
      imgDrag = { id: ev.pointerId, handle: ev.target.dataset.handle || null, sx: x, sy: y, orig: { ...board.image } };
      imgBox.addEventListener('pointermove', onImgMove); imgBox.addEventListener('pointerup', onImgUp); imgBox.addEventListener('pointercancel', onImgUp);
    }
    function onImgMove(ev) {
      if (!imgDrag || ev.pointerId !== imgDrag.id) return;
      const [x, y] = toBoard(ev); const o = imgDrag.orig, dx = x - imgDrag.sx, dy = y - imgDrag.sy;
      let n;
      if (!imgDrag.handle) n = { ...o, x: o.x + dx, y: o.y + dy };
      else {
        const h = imgDrag.handle, ar = o.w / o.h;
        const ax = h.includes('w') ? o.x + o.w : o.x, ay = h.includes('n') ? o.y + o.h : o.y; // противоположный угол — опора
        let w = Math.max(80, Math.abs(x - ax)); let hh = w / ar;
        if (Math.abs(y - ay) * ar > w) { hh = Math.max(80 / ar, Math.abs(y - ay)); w = hh * ar; }
        n = { ...o, w, h: hh, x: h.includes('w') ? ax - w : ax, y: h.includes('n') ? ay - hh : ay };
      }
      imgPreview = n; scheduleBase(); updateImageEditor();
    }
    function onImgUp(ev) {
      if (!imgDrag || ev.pointerId !== imgDrag.id) return;
      imgBox.removeEventListener('pointermove', onImgMove); imgBox.removeEventListener('pointerup', onImgUp); imgBox.removeEventListener('pointercancel', onImgUp);
      const n = imgPreview; imgDrag = null; imgPreview = null;
      if (n) mutate((s) => { if (s.image) Object.assign(s.image, { x: n.x, y: n.y, w: n.w, h: n.h }); }); else updateImageEditor();
    }
    updateImageBtn();
    const copyBtn = $('[data-copy-invite]', app);
    if (copyBtn) on(copyBtn, 'click', async () => {
      const inp = $('.link-field', app); const ok = await copyText(inp.value);
      const lbl = copyBtn.querySelector('.copy-lbl');
      if (ok) { copyBtn.classList.add('copied'); lbl.textContent = t('copied'); copyBtn.querySelector('svg').outerHTML = icon('check');
        setTimeout(() => { copyBtn.classList.remove('copied'); lbl.textContent = t('copyLink'); copyBtn.querySelector('svg').outerHTML = icon('copy'); }, 1800); }
      else { inp.focus(); inp.select(); lbl.textContent = t('copyManual'); }
    });
    const ppCopy = $('[data-copy-link]', app);
    if (ppCopy) on(ppCopy, 'click', async () => {
      const ok = await copyText(inviteUrl); const lbl = ppCopy.querySelector('.copy-lbl');
      if (!ok) { toast(t('copyFailed')); return; }
      ppCopy.classList.add('copied'); lbl.textContent = t('copied'); ppCopy.querySelector('svg').outerHTML = icon('check');
      setTimeout(() => { ppCopy.classList.remove('copied'); lbl.textContent = t('copyLinkShort'); ppCopy.querySelector('svg').outerHTML = icon('copy'); }, 1800);
    });
    const linkInp = $('.link-field', app);
    if (linkInp) on(linkInp, 'focus', () => linkInp.select());
    const taskForm = $('.task-form', app);
    if (taskForm) on(taskForm, 'submit', (e) => {
      e.preventDefault();
      const v = $('#task-edit', app).value.trim();
      mutate((s) => { s.task = v; });
      togglePop($('[data-action="task"]', app), $('#task-pop', app), false);
      toast(t('taskSaved'), 'task');
    });
    const fileInput = $('#file', app);
    on(fileInput, 'change', async () => {
      const f = fileInput.files && fileInput.files[0]; fileInput.value = '';
      if (!f) return;
      if (!/^image\/(png|jpeg)$/.test(f.type)) { toast(t('imageTypeError')); return; }
      const busy = document.createElement('div'); busy.className = 'busy'; busy.textContent = t('imageLoading'); frame.appendChild(busy);
      try {
        const url = URL.createObjectURL(f); const im = await loadImg(url); URL.revokeObjectURL(url);
        const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight));
        const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        const toBlob = (type, q) => new Promise((r) => c.toBlob(r, type, q));
        let data = f.type === 'image/png' ? await toBlob('image/png') : await toBlob('image/jpeg', 0.9);
        if (data.size > 8000000) data = await toBlob('image/jpeg', 0.88);
        const imgId = uid();
        try { await IDB.put(imgId, data); } catch (e) { toast(t('storageFull')); return; }
        mutate((s) => { s.image = { ...fitImage(imgId, w, h), locked: false }; s.imgIds = [...(s.imgIds || []), imgId]; });
      } catch (e) { toast(t('imageTypeError')); } finally { busy.remove(); }
    });
    function shareResult(kind = 'share') {
      const sid = uid();
      const snap = { id: sid, boardId, kind, title: board.title, createdAt: Date.now(), image: board.image ? clone(board.image) : null, elements: clone(board.elements) };
      if (!store.set(K.snap(sid), snap)) return null;
      mutate((s) => { s.snapshots = [...(s.snapshots || []), sid]; });
      return snap;
    }
    on(app, 'click', (e) => {
      const k = e.target.closest('[data-kick]');
      if (k && isTeacher) {
        const pid = k.dataset.kick, name = k.dataset.name;
        mutate((s) => { s.kicked = [...new Set([...(s.kicked || []), pid])]; });
        store.del(K.pres(boardId, pid));
        renderPeople(); toast(t('disconnected', { name }), 'users');
        return;
      }
      const b = e.target.closest('[data-action]'); if (!b) return;
      const a = b.dataset.action;
      if (a === 'color') { if (ui.tool !== 'pen') { ui.tool = 'pen'; frame.dataset.tool = 'pen'; ui.flyout = true; } else ui.flyout = !ui.flyout; syncToolbar(); }
      else if (a === 'undo') undo();
      else if (a === 'redo') redo();
      else if (a === 'people') openPeople(b);
      else if (a === 'task') { togglePop(b, $('#task-pop', app)); const d = $('.new-dot', app); if (d) d.hidden = true; const ta = $('#task-edit', app); if (ta && !$('#task-pop', app).hidden) ta.focus(); }
      else if (a === 'invite') { togglePop(b, $('#invite-pop', app)); }
      else if (a === 'image') {
        if (!board.image) fileInput.click();
        else if (board.image.locked) confirmModal({ title: t('removeImageTitle'), text: t('removeImageText'), confirm: t('remove'), danger: true, onConfirm: () => {
          const prev = clone(board.image);
          if (!mutate((s) => { s.image = null; })) return;
          toast(t('imageRemoved'), 'imageOff', { label: t('restore'), onClick: () => mutate((s) => { if (!s.image) s.image = prev; }) });
        } });
      } else if (a === 'erase-mine') {
        // только штрихи, текст, стикеры и штампы этого ученика; картинка и работа остальных остаются
        closePops(); if (editor) commitEditor();
        confirmModal({ title: t('eraseMineTitle'), confirm: t('eraseMineConfirm'), danger: true, onConfirm: () => {
          const mine = board.elements.filter((x) => x.author === me.pid);
          if (mine.length) { deselect(); commit({ added: [], removed: clone(mine), changed: [] }); }
          toast(t('eraseMineDone'), 'trash');
        } });
      } else if (a === 'leave') {
        closePops(); if (editor) commitEditor();
        confirmModal({ title: t('leaveTitle'), confirm: t('leave'), onConfirm: () => {
          // отключение от сессии: присутствие снимается, записи остаются на доске
          store.del(K.pres(boardId, me.pid)); sessionStorage.removeItem(K.me(boardId)); sessionStorage.setItem('wb:left:' + boardId, '1');
          setTimeout(route, 0);
        } });
      } else if (a === 'clear') {
        closePops();
        confirmModal({ title: t('clearTitle'), text: t('clearText'), confirm: t('clearConfirm'), danger: true, onConfirm: () => {
          if (board.elements.length) { commit({ added: [], removed: clone(board.elements), changed: [] }); deselect(); }
          if (board.image) mutate((s) => { s.image = null; });
          toast(t('clearDone'), 'trash');
        } });
      } else if (a === 'end') {
        confirmModal({ title: t('endTitle'), text: t('endText'), confirm: t('endConfirm'), onConfirm: () => {
          if (editor) commitEditor();
          const snap = shareResult('final'); if (!snap) return;
          mutate((s) => { s.status = 'ended'; s.endedAt = Date.now(); s.finalSnapshotId = snap.id; });
          setTimeout(route, 0);
        } });
      }
      else if (a === 'sel-delete') deleteSelected();
      else if (b.dataset.kick !== undefined) { /* handled below */ }
      else if (a === 'sel-edit') { const el = board.elements.find((x) => x.id === selectedId); if (el) openEditor(el.x, el.y, el); }
    });

    /* ---------- Selection ---------- */
    let selbar = null;
    function select(id) { selectedId = id; renderLive(); updateSelBar(); }
    function deselect() { if (!selectedId) return; selectedId = null; renderLive(); updateSelBar(); }
    function updateSelBar() {
      if (selbar) { selbar.remove(); selbar = null; }
      const el = selectedId && board.elements.find((x) => x.id === selectedId);
      if (!el || (drag && drag.moved)) return;
      const b = bbox(el);
      selbar = document.createElement('div'); selbar.className = 'selbar glass'; selbar.setAttribute('role', 'toolbar');
      const cur = String(el.color || '').toUpperCase();
      selbar.innerHTML = `${isEditable(el) ? `<button class="sb-btn" data-action="sel-edit">${icon('edit', 'ic-sm')}<span>${esc(t('editText'))}</span></button>` : ''}`
        + (el.type === 'text' ? `<span class="sb-sep" aria-hidden="true"></span><div class="sb-colors" role="radiogroup" aria-label="${esc(t('textColor'))}">${TEXT_COLORS.map((c) => { const p = PALETTE.find((q) => q.c === c); return `<button class="sb-swatch" data-text-color="${c}" role="radio" aria-checked="${c === cur}" aria-label="${esc(p ? p[lang] : c)}" title="${esc(p ? p[lang] : c)}"><span style="background:${c}"></span></button>`; }).join('')}</div>` : '')
        + `${isEditable(el) || el.type === 'text' ? '<span class="sb-sep" aria-hidden="true"></span>' : ''}<button class="sb-btn sb-danger" data-action="sel-delete" aria-label="${esc(t('deleteEl'))}" title="${esc(t('deleteEl'))}">${icon('trash', 'ic-sm')}</button>`;
      selbar.addEventListener('pointerdown', (e) => e.stopPropagation());
      selbar.addEventListener('click', (e) => {
        const c = e.target.closest('[data-text-color]'); if (!c) return;
        const cur2 = board.elements.find((x) => x.id === selectedId);
        if (cur2 && cur2.type === 'text' && canModify(cur2) && cur2.color !== c.dataset.textColor) commit({ added: [], removed: [], changed: [[clone(cur2), { ...clone(cur2), color: c.dataset.textColor }]] });
        updateSelBar(); // цвет пера (ui.colors) не меняется
      });
      overlay.appendChild(selbar);
      const sw = selbar.offsetWidth, sh = selbar.offsetHeight, fw = BW * scale;
      let top = b.y * scale - 12 - sh; if (top < 4) top = (b.y + b.h) * scale + 12;
      const left = Math.max(4, Math.min(fw - sw - 4, (b.x + b.w / 2) * scale - sw / 2));
      selbar.style.left = left + 'px'; selbar.style.top = top + 'px';
    }
    function deleteSelected() {
      const el = board.elements.find((x) => x.id === selectedId); if (!el || !canModify(el)) return;
      deselect(); commit({ added: [], removed: [clone(el)], changed: [] });
    }

    /* ---------- Экранная клавиатура (Safari на iPad) ----------
       Клавиатура уменьшает visualViewport, а раскладка (100dvh) остаётся прежней. Пока открыт редактор текста или
       стикера: панель инструментов прячется, а доска временно сдвигается вверх так, чтобы редактор был над клавиатурой.
       Клавиатура закрылась → сдвиг снимается, панель возвращается, прокрутку Safari сбрасываем.
       window.__wbKeyboard — только для эмуляции в тестах (высота «клавиатуры» в px); в Safari не используется. */
    const vv = window.visualViewport;
    let kbShift = 0;
    const boardApp = app.firstElementChild;
    function keyboardHeight() {
      if (typeof window.__wbKeyboard === 'number') return window.__wbKeyboard;
      return vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    }
    function fitKeyboard() {
      const kb = editor ? keyboardHeight() : 0;
      const open = kb > 80;
      boardApp.classList.toggle('kb-open', open);
      let shift = 0;
      if (open) {
        const visBottom = window.innerHeight - kb - 12;
        // положение редактора без сдвига (через offset*, чтобы не зависеть от идущей анимации transform)
        const top = stage.getBoundingClientRect().top + frame.offsetTop + overlay.offsetTop + editor.ta.offsetTop;
        const bottom = top + editor.ta.offsetHeight;
        const barH = editBar ? editBar.offsetHeight + 8 : 0;
        shift = Math.max(0, bottom - visBottom);
        shift = Math.min(shift, Math.max(0, top - barH - 8)); // не уводить начало текста и «Готово» за верх экрана
      }
      if (Math.abs(shift - kbShift) > 0.5) { kbShift = shift; frame.style.transform = shift ? `translateY(${-Math.round(shift)}px)` : ''; }
      if (!open && (window.scrollY || document.scrollingElement.scrollTop)) window.scrollTo(0, 0);
    }
    if (vv) { on(vv, 'resize', fitKeyboard); on(vv, 'scroll', fitKeyboard); }

    /* ---------- Text editor ---------- */
    let editBar = null;
    function openEditor(x, y, el = null, kind = el ? el.type : 'text') {
      if (editor) commitEditor();
      deselect();
      const sticky = kind === 'sticky';
      const ta = document.createElement('textarea');
      ta.className = 'text-editor' + (sticky ? ' sticky-editor' : '');
      ta.setAttribute('aria-label', t(sticky ? 'tool_sticky' : 'tool_text')); ta.placeholder = t(sticky ? 'stickyPh' : 'textPh');
      ta.spellcheck = false; ta.autocapitalize = 'sentences';
      const size = el ? el.size : (sticky ? STICKY.size : sizeFor('text'));
      const color = el ? el.color : (sticky ? STICKY.ink : colorFor('text'));
      ta.value = el ? el.text : '';
      editor = { ta, x, y, el, kind, size, color, w: el && el.w ? el.w : STICKY.w, done: false };
      ta.style.color = color;
      overlay.appendChild(ta);
      // Панель редактора: «Готово» (закрывает клавиатуру и сохраняет) и, для существующего объекта, «Удалить»
      editBar = document.createElement('div'); editBar.className = 'edit-bar glass';
      editBar.innerHTML = `${el ? `<button class="btn btn-ghost eb-delete" type="button" data-edit="delete">${icon('trash', 'ic-sm')}${esc(t('deleteEl'))}</button>` : ''}<button class="btn btn-primary eb-done" type="button" data-edit="done">${icon('check', 'ic-sm')}${esc(t('done'))}</button>`;
      editBar.addEventListener('pointerdown', (e) => e.preventDefault()); // не терять фокус редактора
      if (el) editBar.querySelector('[data-edit="delete"]').addEventListener('click', () => { const e2 = editor; if (!e2 || !e2.el) return; cancelEditor(); commit({ added: [], removed: [clone(e2.el)], changed: [] }); });
      editBar.querySelector('[data-edit="done"]').addEventListener('click', () => { commitEditor(); });
      overlay.appendChild(editBar);
      positionEditor(); scheduleBase();
      ta.addEventListener('input', positionEditor);
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cancelEditor(); }
        else if (e.key === 'Enter' && !e.shiftKey && !sticky) { e.preventDefault(); commitEditor(); }
        e.stopPropagation();
      });
      ta.addEventListener('blur', () => setTimeout(commitEditor, 0));
      ta.focus({ preventScroll: true });
      setTimeout(fitKeyboard, 0); setTimeout(fitKeyboard, 350); // клавиатура выезжает с анимацией
    }
    function positionEditor() {
      if (!editor) return;
      const { ta, x, y, size, kind, w } = editor;
      if (kind === 'sticky') {
        const h = stickyHeight(ta.value || ' ', w, size);
        Object.assign(ta.style, { left: x * scale + 'px', top: y * scale + 'px', width: w * scale + 'px', height: h * scale + 'px', fontSize: size * scale + 'px', padding: STICKY.pad * scale + 'px', fontFamily: FONT });
      } else {
        const m = measureText(ta.value || t('textPh'), size);
        Object.assign(ta.style, { left: x * scale - 6 + 'px', top: y * scale - 4 + 'px', fontSize: size * scale + 'px', fontFamily: FONT, width: m.bw * scale + 28 + 'px', height: m.bh * scale + 12 + 'px' });
      }
      if (editBar) { editBar.style.left = x * scale + 'px'; editBar.style.top = Math.max(4, y * scale - 54) + 'px'; }
    }
    function closeEditBar() { if (editBar) { editBar.remove(); editBar = null; } }
    function cancelEditor() { if (!editor) return; const e = editor; editor = null; e.done = true; e.ta.remove(); closeEditBar(); scheduleBase(); fitKeyboard(); }
    function commitEditor() {
      if (!editor || editor.done) return;
      const e = editor; e.done = true; editor = null; closeEditBar(); fitKeyboard();
      const reselect = () => { if (ui.tool === 'select' && e.el && board.elements.some((x) => x.id === e.el.id)) select(e.el.id); };
      setTimeout(reselect, 0);
      const text = e.ta.value.replace(/\s+$/, ''); e.ta.remove();
      const shape = (txt) => (e.kind === 'sticky' ? { w: e.w, h: stickyHeight(txt, e.w, e.size) } : measureText(txt, e.size));
      if (e.el) {
        if (!text) commit({ added: [], removed: [clone(e.el)], changed: [] });
        else if (text !== e.el.text) { const after = { ...clone(e.el), text, ...shape(text) }; commit({ added: [], removed: [], changed: [[clone(e.el), after]] }); }
        else scheduleBase();
      } else if (text) {
        const base = { id: uid(), type: e.kind, x: e.x, y: e.y, text, size: e.size, color: e.color, author: me.pid, z: nextZ(), ...shape(text) };
        if (e.kind === 'sticky') base.bg = STICKY.bg;
        commit({ added: [base], removed: [], changed: [] });
      } else scheduleBase();
    }

    /* ---------- Pointer input ---------- */
    let activePointer = null;
    const toBoard = (ev) => { const r = live.getBoundingClientRect(); return [(ev.clientX - r.left) / scale, (ev.clientY - r.top) / scale]; };
    const topHit = (x, y, mode, tol, only) => { for (let i = board.elements.length - 1; i >= 0; i--) { const el = board.elements[i]; if (only && !only.has(el.type)) continue; if (hitEl(el, x, y, tol, mode)) return el; } return null; };
    const topHitOwn = (x, y, tol) => { for (let i = board.elements.length - 1; i >= 0; i--) { const el = board.elements[i]; if (SELECTABLE.has(el.type) && canModify(el) && hitEl(el, x, y, tol, 'select')) return el; } return null; };
    const isEditable = (el) => el && (el.type === 'text' || el.type === 'sticky');
    let lastDenied = 0;
    const denied = () => { if (Date.now() - lastDenied > 2500) { lastDenied = Date.now(); toast(t('notYours'), 'lock'); } };
    // Ластик «закрашиванием»: стирает часть штриха под пальцем; фигуры, текст и реакции — целиком.
    // Чужие пометки ученик стереть не может.
    function densify(p, step) {
      const out = [p[0], p[1]];
      for (let i = 2; i < p.length; i += 2) {
        const x0 = out[out.length - 2], y0 = out[out.length - 1], x1 = p[i], y1 = p[i + 1];
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step);
        for (let k = 1; k <= n; k++) out.push(+(x0 + (x1 - x0) * k / n).toFixed(1), +(y0 + (y1 - y0) * k / n).toFixed(1));
      }
      return out;
    }
    function eraseSegment(ax, ay, bx, by) {
      const r = SIZES.eraser[ui.eraserSize];
      const out = []; let changed = false;
      for (const el of board.elements) {
        const bb = bbox(el);
        const near = Math.max(ax, bx) + r >= bb.x && Math.min(ax, bx) - r <= bb.x + bb.w && Math.max(ay, by) + r >= bb.y && Math.min(ay, by) - r <= bb.y + bb.h;
        if (!near) { out.push(el); continue; }
        if (el.type === 'pen' || el.type === 'marker') {
          const rr = r + el.sw / 2, src = el.pts;
          let touched = false;
          for (let i = 0; i < src.length; i += 2) if (distSeg(src[i], src[i + 1], ax, ay, bx, by) <= rr) { touched = true; break; }
          if (!touched && src.length > 2) { for (let i = 0; i < src.length - 2 && !touched; i += 2) if (distSeg(ax, ay, src[i], src[i + 1], src[i + 2], src[i + 3]) <= rr) touched = true; }
          if (!touched) { out.push(el); continue; }
          if (!canModify(el)) { denied(); out.push(el); continue; }
          changed = true;
          const pts = densify(src, 2); let run = [];
          const flush = () => { if (run.length >= 4) out.push({ ...el, id: uid(), pts: run }); run = []; };
          for (let i = 0; i < pts.length; i += 2) { if (distSeg(pts[i], pts[i + 1], ax, ay, bx, by) <= rr) flush(); else run.push(pts[i], pts[i + 1]); }
          flush();
        } else if (hitEl(el, bx, by, r, 'erase') || hitEl(el, (ax + bx) / 2, (ay + by) / 2, r, 'erase')) {
          if (!canModify(el)) { denied(); out.push(el); continue; }
          changed = true;
        } else out.push(el);
      }
      if (changed) { board.elements = out; scheduleBase(); }
    }

    if (!readOnly) {
      on(live, 'pointerdown', (ev) => {
        if (activePointer !== null) return;
        if (ev.button && ev.button !== 0) return;
        if (editor) { commitEditor(); return; }
        // Первое касание по полотну при открытом задании/списке только закрывает его — без случайной точки
        if (app.querySelector('.popover:not([hidden])')) { closePops(); return; }
        if (ui.flyout) { const wasReact = flyout.dataset.mode === 'react'; ui.flyout = false; syncToolbar(); if (wasReact) return; }
        const [x, y] = toBoard(ev);
        const tool = ui.tool;
        activePointer = ev.pointerId;
        try { live.setPointerCapture(ev.pointerId); } catch (e) { /* noop */ }
        if (tool === 'pen' || tool === 'marker') {
          draft = { id: uid(), type: tool, color: colorFor(tool), sw: sizeFor(tool), pts: [+x.toFixed(1), +y.toFixed(1)], author: me.pid };
          renderLive(); broadcastDraft();
        } else if (['line', 'rect', 'ellipse'].includes(tool)) {
          draft = { id: uid(), type: tool, color: colorFor(tool), sw: sizeFor(tool), x1: x, y1: y, x2: x, y2: y, author: me.pid };
        } else if (tool === 'eraser') { erasing = { before: clone(board.elements), x, y }; eraseSegment(x, y, x, y); renderLive(); }
        else if (tool === 'select') {
          const el = isTeacher ? topHit(x, y, 'select', 8 / scale, SELECTABLE) : topHitOwn(x, y, 8 / scale);
          if (!el) { activePointer = null; deselect(); return; }
          if (!canModify(el)) { activePointer = null; deselect(); denied(); return; }
          const now = Date.now();
          // двойной клик / двойное касание — редактировать текст или стикер
          if (isEditable(el) && lastTap.id === el.id && now - lastTap.t < 400) { activePointer = null; lastTap = { t: 0, id: null }; ev.preventDefault(); openEditor(el.x, el.y, el); return; }
          lastTap = { t: now, id: el.id };
          select(el.id);
          drag = { id: el.id, sx: x, sy: y, orig: clone(el), preview: el, moved: false };
        }
      });
      on(live, 'pointermove', (ev) => {
        if (ev.pointerId !== activePointer) return;
        const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
        const [x, y] = toBoard(ev);
        if (draft && draft.pts) {
          for (const ce of (evs.length ? evs : [ev])) {
            const [cx, cy] = toBoard(ce); const p = draft.pts; const lx = p[p.length - 2], ly = p[p.length - 1];
            if (Math.hypot(cx - lx, cy - ly) >= 0.75) p.push(+cx.toFixed(1), +cy.toFixed(1));
          }
          renderLive(); broadcastDraft();
        } else if (draft) {
          let x2 = x, y2 = y;
          if (ev.shiftKey) {
            if (draft.type === 'rect' || draft.type === 'ellipse') { const d = Math.max(Math.abs(x - draft.x1), Math.abs(y - draft.y1)); x2 = draft.x1 + Math.sign(x - draft.x1 || 1) * d; y2 = draft.y1 + Math.sign(y - draft.y1 || 1) * d; }
            else { const a = Math.round(Math.atan2(y - draft.y1, x - draft.x1) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(x - draft.x1, y - draft.y1); x2 = draft.x1 + Math.cos(a) * l; y2 = draft.y1 + Math.sin(a) * l; }
          }
          draft.x2 = x2; draft.y2 = y2; renderLive(); broadcastDraft();
        } else if (erasing) { for (const ce of (evs.length ? evs : [ev])) { const [cx, cy] = toBoard(ce); eraseSegment(erasing.x, erasing.y, cx, cy); erasing.x = cx; erasing.y = cy; } renderLive(); }
        else if (drag) {
          const dx = x - drag.sx, dy = y - drag.sy;
          if (!drag.moved && Math.hypot(dx, dy) * scale < 4) return; // порог начала перетаскивания
          if (!drag.moved) { drag.moved = true; updateSelBar(); scheduleBase(); }
          drag.preview = translateEl(drag.orig, dx, dy); renderLive();
        }
      });
      const finish = (ev) => {
        if (ev.pointerId !== activePointer) return;
        activePointer = null;
        const [x, y] = toBoard(ev);
        const tool = ui.tool;
        if (draft) {
          const d = draft; draft = null;
          let keep = true;
          if (!d.pts) { keep = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 4; }
          if (keep) { d.z = nextZ(); commit({ added: [d], removed: [], changed: [] }); }
          broadcastEnd(); renderLive();
        } else if (erasing) {
          const before = erasing.before; erasing = null;
          const was = new Set(before.map((e) => e.id)), now = new Set(board.elements.map((e) => e.id));
          const op = { added: board.elements.filter((e) => !was.has(e.id)).map(clone), removed: before.filter((e) => !now.has(e.id)), changed: [] };
          if (op.added.length || op.removed.length) commit(op); else scheduleBase();
          renderLive();
        } else if (drag) {
          const dr = drag; drag = null;
          if (dr.moved && ev.type !== 'pointercancel') commit({ added: [], removed: [], changed: [[dr.orig, dr.preview]] });
          scheduleBase(); renderLive(); updateSelBar();
        } else if ((tool === 'text' || tool === 'sticky') && ev.type === 'pointerup') {
          const hit = topHit(x, y, 'select', 6 / scale);
          if (hit && (hit.type === 'text' || hit.type === 'sticky') && canModify(hit)) openEditor(hit.x, hit.y, hit);
          else if (tool === 'sticky') openEditor(Math.max(0, Math.min(BW - STICKY.w, x - STICKY.w / 2)), Math.max(0, Math.min(BH - STICKY.minH, y - 30)), null, 'sticky');
          else openEditor(x, y - sizeFor('text') * 0.6);
        } else if (tool === 'stamp' && ev.type === 'pointerup') {
          commit({ added: [{ id: uid(), type: 'stamp', kind: ui.stamp, x, y, size: STAMP, author: me.pid, z: nextZ() }], removed: [], changed: [] });
        }
      };
      // стрелка над объектом показывает, что его можно двигать
      on(live, 'pointermove', (ev) => {
        if (activePointer !== null || ui.tool !== 'select' || ev.pointerType === 'touch') return;
        const [x, y] = toBoard(ev); const el = isTeacher ? topHit(x, y, 'select', 8 / scale, SELECTABLE) : topHitOwn(x, y, 8 / scale);
        live.style.cursor = el && canModify(el) ? 'move' : '';
      });
      on(live, 'pointerup', finish);
      on(live, 'pointercancel', finish);
      on(live, 'dblclick', (ev) => {
        if (!['select', 'text', 'sticky'].includes(ui.tool)) return;
        const [x, y] = toBoard(ev); const el = isTeacher ? topHit(x, y, 'select', 6 / scale, SELECTABLE) : topHitOwn(x, y, 6 / scale);
        if (!isEditable(el) || !canModify(el) || (editor && editor.el && editor.el.id === el.id)) return;
        openEditor(el.x, el.y, el);
      });
    }

    /* ---------- Keyboard (MacBook) ---------- */
    on(window, 'keydown', (e) => {
      if (readOnly || $('#modal-root').firstChild) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteSelected(); return; }
      if (e.key === 'Escape') { deselect(); closePops(); if (ui.flyout) { ui.flyout = false; syncToolbar(); } return; }
      if (mod || e.altKey) return;
      const tk = myTools.find((x) => x.key === e.key.toLowerCase());
      if (tk) setTool(tk.id);
    });
    // Блокируем pinch-zoom Safari только над полотном
    on(frame, 'gesturestart', (e) => e.preventDefault());
    on(frame, 'touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

    const ro = new ResizeObserver(layout); ro.observe(stage);
    disposers.push(() => ro.disconnect());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { scheduleBase(); positionFlyout(); });
    if (isTeacher && sessionStorage.getItem('wb:justCreated') === boardId) {
      sessionStorage.removeItem('wb:justCreated');
      setTimeout(() => $('[data-action="invite"]', app) && $('[data-action="invite"]', app).click(), 250);
    }
    return () => { if (editor) commitEditor(); disposers.forEach((f) => f()); remote.clear(); };
  }

  route();
})();

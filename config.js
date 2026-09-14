// Настройки сайта Before. Единственный файл, который нужно править руками.
// Секретов здесь нет и быть не должно: токен бота и твой chat_id живут
// в Script Properties веб-приложения Apps Script (см. apps-script/Code.gs).
window.BEFORE_CONFIG = {
  // Куда писать клиенту: ссылка на твой Telegram.
  telegram: "https://t.me/marchvlv",

  // Текст, который подставится в поле ввода при переходе в чат.
  // {plan} заменяется на название тарифа; без тарифа вся вставка убирается.
  tgMessage: "Привет! Хочу подключить Before{plan}",
  tgPlanSuffix: " по тарифу {title}",

  // Сколько ждать ответа. Подставляется в текст «напишу в течение …».
  responseTime: "3 часов",

  // URL веб-приложения Apps Script (Deploy → Web app → Anyone).
  // Пока пусто, форма копирует текст заявки в буфер и предлагает написать в Telegram.
  formEndpoint: "",

  // Ссылки на документы в футере. Пустая строка: ссылка скрывается.
  docs: {
    // Пустая строка прячет ссылку. Вернуть, когда появится приём оплаты.
    offer: "",
    privacy: "privacy.html"
  },

  plans: {
    start: { title: "Start", price: 10000 },
    pro: { title: "Pro", price: 25000 },
    team: { title: "Team", price: 50000 }
  }
};

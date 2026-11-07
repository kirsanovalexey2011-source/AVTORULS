# GARAGE 78 — демонстрационный сайт автосервиса

Современный адаптивный landing page для портфолио. Сайт публикуется как статический проект на GitHub Pages; для настоящего приёма заявок подготовлен отдельный серверный endpoint на Cloudflare Workers.

## Возможности

- Адаптивная вёрстка для desktop, tablet и mobile.
- Светлая и тёмная темы с сохранением выбора в браузере.
- Мобильное меню, подсветка активного раздела и якорная навигация.
- Карточки услуг с быстрым выбором услуги в форме.
- Проверка имени, российского номера телефона и обязательных полей.
- Демонстрационный режим формы: подготовка и копирование текста без отправки данных.
- Подключаемая отправка заявок в Telegram через Cloudflare Worker.
- Проверка формы на сервере, allowlist источников, honeypot, ограничение размера запроса и хранение Telegram-секретов только на backend.
- FAQ, плавные появления блоков, кнопка «наверх», reduced-motion support.
- SEO metadata, Open Graph, canonical, robots.txt, sitemap.xml, favicon и страница 404.
- CI-проверки структуры HTML, внутренних ссылок, локальных файлов и синтаксиса JavaScript.

## Структура проекта

```text
.
├── index.html
├── 404.html
├── favicon.svg
├── robots.txt
├── sitemap.xml
├── .nojekyll
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── site-config.js
│       └── main.js
├── cloudflare/worker.js
├── scripts/check_site.py
└── .github/workflows/quality.yml
```

## Локальный запуск

Откройте `index.html` в браузере либо запустите статический сервер:

```bash
python -m http.server 8000
```

Откройте `http://localhost:8000`.

## Публикация сайта

В **Settings → Pages → Build and deployment** выберите **Deploy from a branch**, ветку `main` и каталог `/(root)`. GitHub Pages публикует статические файлы; серверные языки и backend-код на нём не выполняются.

## Настройка под реального заказчика

Перед передачей сайта замените демонстрационные сведения на подтверждённые данные бизнеса:

1. Обновите название, город, реальные услуги, марки, цены, адрес и график работы в `index.html`.
2. Заполните публичные поля в `assets/js/site-config.js`: телефон, отображаемый телефон, email, адрес, часы работы, ссылку на карту.
3. Подготовьте и опубликуйте фактическую политику конфиденциальности. Укажите её HTTPS-ссылку в `privacyUrl`.
4. Пока backend не настроен, `formEndpoint` должен оставаться пустым: форма работает только в режиме подготовки текста и не отправляет данные.
5. Не включайте отправку персональных данных до согласования правового основания, текста согласия и политики конфиденциальности с владельцем бизнеса.

## Подключение заявок в Telegram через Cloudflare Worker

Worker находится в `cloudflare/worker.js`. Он отправляет заявки боту Telegram, но сам по себе не запущен: его нужно отдельно развернуть в Cloudflare.

1. Создайте Worker в Cloudflare Dashboard и опубликуйте содержимое файла `cloudflare/worker.js`.
2. В настройках Worker добавьте секреты:
   - `TELEGRAM_BOT_TOKEN` — токен бота как **Secret**;
   - `TELEGRAM_CHAT_ID` — ID личного чата или группы как **Secret**.
3. Добавьте переменную `ALLOWED_ORIGINS` со списком точных origin через запятую. Для этого сайта: `https://kirsanovalexey2011-source.github.io`. Если появится собственный домен, добавьте его origin отдельно.
4. Скопируйте HTTPS URL развернутого Worker и укажите его в `formEndpoint` файла `assets/js/site-config.js`.
5. Укажите публичную HTTPS-ссылку на утверждённую политику конфиденциальности в `privacyUrl`.
6. Проверьте тестовую заявку, доставку в Telegram, ошибочные номера и недоступность Worker.

**Важно по безопасности:** Telegram-токен нельзя помещать в `site-config.js`, HTML или любой публичный файл репозитория. Он должен существовать только в Cloudflare Worker Secrets. Включите Cloudflare rate limiting для endpoint (например, ограничение нескольких отправок в минуту с одного IP) и рассмотрите Turnstile перед публичным запуском. CORS и honeypot снижают часть рисков, но сами по себе не заменяют защиту от спама.

## Проверки

Локально:

```bash
python scripts/check_site.py
node --check assets/js/site-config.js
node --check assets/js/main.js
node --check cloudflare/worker.js
```

Те же проверки запускаются GitHub Actions при push и pull request в `main`.

## Ограничения текущей демо-версии

GARAGE 78 — вымышленная концепция, а не реальный автосервис и не выполненная работа для стороннего заказчика. Цены демонстрационные. Реальные контакты, адрес, расписание, перечень услуг и юридические документы не предоставлены.

Форма не отправляет данные до настройки Cloudflare Worker и публикации политики конфиденциальности. Наличие подготовленного Worker-кода не означает, что endpoint уже развернут или что Telegram-уведомления работают.

## Изображения

- Xalo Mustafa — [Black cars in auto repair shop](https://unsplash.com/photos/black-cars-in-auto-repair-shop-JrC5BK-kWYE), Unsplash License.
- Artem Podrez — [A Mechanic Working on an Engine in an Auto Repair Shop](https://www.pexels.com/photo/a-mechanic-working-on-an-engine-in-an-auto-repair-shop-8986040/), Pexels License.


## Развёртывание Worker через Wrangler CLI

В репозитории уже есть `cloudflare/wrangler.jsonc`. После установки Node.js и входа в Cloudflare:

```bash
cd cloudflare
npx wrangler@latest login
npx wrangler@latest secret put TELEGRAM_BOT_TOKEN
npx wrangler@latest secret put TELEGRAM_CHAT_ID
npx wrangler@latest deploy
```

Команды `secret put` запрашивают значения в интерактивном режиме — не вставляйте токены в командную строку, историю Git или публичные файлы. Переменная `ALLOWED_ORIGINS` задаётся в `wrangler.toml`; обновите её при переходе на собственный домен.

Для локальных проверок Worker используются встроенные возможности Node.js: `node --test tests/*.test.mjs`. Тесты подменяют вызов Telegram API и не отправляют реальные сообщения.

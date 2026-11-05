# Quizly Telegram Bot + Mini App

Quizly — Telegram bot va Telegram Mini App. Foydalanuvchi Telegram akkaunti bilan kiradi. Ma'lumotlar `data.json` faylida saqlanadi.

## Talablar
- Node.js 18 yoki undan yangi
- Telegram bot tokeni (BotFather orqali)
- Telegram Mini App uchun ommaga ochiq HTTPS manzil (masalan, HTTPS hosting yoki tunnel)

## O'rnatish
1. ZIP faylni oching.
2. Terminalda loyiha papkasiga kiring.
3. `npm install` buyrug'ini bajaring.
4. `.env.example` faylidan nusxa olib `.env` deb nomlang.
5. `.env` ichiga `BOT_TOKEN` va `APP_URL` kiriting.
6. `npm start` yoki `node bot.js` buyrug'ini bajaring.

## Bot sozlash
- BotFather'da bot yarating va tokenni oling.
- `APP_URL` qiymati Mini App joylashgan ommaviy HTTPS URL bo'lishi shart.
- Botga `/start` yuboring va “Quizly'ni ochish” tugmasini bosing.

## Lokal test
`.env` ichida `DEV_MODE=true` qilsangiz oddiy brauzerda demo foydalanuvchi bilan API'ni sinashingiz mumkin. Bu rejimda Telegram autentifikatsiyasi chetlab o'tiladi. Uni ommaviy serverda yoqmang.

## Buyruqlar
- `/start` — bosh menyu
- `/rank` — Top 10 va shaxsiy o'rin
- `/profile` — profil va statistika

## Data
- `data.json` foydalanuvchilar, quiz savollari, natijalar va xonalarni saqlaydi.
- Ishlayotgan paytda `data.json` faylini qo'lda tahrirlamang.
- Muntazam backup oling.

## Muhim cheklovlar
- Telegram Mini App oddiy `localhost` manzilini boshqa foydalanuvchilarga ochib bera olmaydi. Do'stlar ishlatishi uchun HTTPS hosting kerak.
- JSON fayl kichik loyiha va bir server uchun qulay, lekin parallel yozuvlar, katta yuklama va ko'p serverli deploy uchun PostgreSQL yaxshiroq. Bu loyihada bitta Node.js jarayoni va atomik fayl almashtirish ishlatiladi.
- Botda telefon raqami avtomatik olinmaydi. Foydalanuvchi kontaktini alohida ulashishi kerak.
- Solo quiz, XP, profil, reyting va xona yaratish/join ishlaydi. Multiplayer xona yaratish/join mavjud; jonli savol almashish, xona ichidagi timer va match yakunlash hali to'liq implementatsiya qilinmagan.
- Ishga tushirishdan oldin HTTPS, server backup, loglar, rate limit va ma'lumotlarni himoyalashni sozlang.

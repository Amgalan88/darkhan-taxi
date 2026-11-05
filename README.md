# Дархан Такси

Mobile-first PWA такси веб апп — Дархан хот, Монгол.

## Stack
Next.js (App Router) · Supabase (`taxi` schema) · Vercel · Leaflet/OSM

## Demo нэвтрэлт
| Үүрэг | Утас | Код |
|---|---|---|
| Админ | 99000001 | 1234 |
| Жолооч | 99000002 | 1234 |
| Зорчигч | 99000003 | 1234 |

SMS: одоогоор демо код (`src/lib/sms.ts`). Дараа нь verify.mn залгана.

## Локал
```bash
cp .env.example .env.local   # утгуудыг бөглөнө
npm i && npm run dev
```

## Тариф
Үндсэн 3000₮ + 1000₮/км (админ солино).

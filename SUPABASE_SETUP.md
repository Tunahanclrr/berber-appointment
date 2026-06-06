# Supabase Setup

Bu projede artik tek SQL dosyasi var: `SUPABASE_SETUP.sql`.

## 1. SQL'i Calistir

Supabase Dashboard > SQL Editor ac.

`SUPABASE_SETUP.sql` dosyasinin tamamini yapistirip `Run` de.

Bu dosya sunlari hazirlar:
- personel PIN login fonksiyonlari
- staff dashboard randevu okuma izinleri
- calisma saatleri alani
- telefona bildirim gondermek icin cihaz kaydi tablosu

## 2. Web Push Anahtari Olustur

Terminalde:

```bash
npx web-push generate-vapid-keys
```

Cikan `Public Key` degerini lokal `.env` dosyasina ekle:

```env
VITE_VAPID_PUBLIC_KEY=PUBLIC_KEY_BURAYA
```

Supabase Edge Function secrets tarafina da sunlari ekle:

```env
VAPID_PUBLIC_KEY=PUBLIC_KEY_BURAYA
VAPID_PRIVATE_KEY=PRIVATE_KEY_BURAYA
VAPID_SUBJECT=mailto:destek@berberrandevu.com
SUPABASE_URL=SUPABASE_URL_BURAYA
SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_BURAYA
```

## 3. Edge Function Deploy Et

```bash
supabase functions deploy send-appointment-push
```

Sonra personel paneline telefondan gir:

1. `/staff/login`
2. giris yap
3. `/staff/dashboard` icinde `Bildirimleri Ac` butonuna bas
4. tarayici bildirim iznini onayla

Artik yeni randevu olusunca personelin telefonuna bildirim gider.

## Notlar

- iPhone icin Safari'de siteyi ana ekrana eklemek gerekebilir.
- Bildirimler HTTPS deploy ortaminda calisir. Localhost test icin uygundur.
- Musteri randevu ekrani randevu olusturdugunda bildirim otomatik tetiklenir.

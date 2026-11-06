# FtkSaaS Dummy Data

FtkSaaS uygulama reposundan bağımsız Snaplet çalışma alanı. Uygulama kodu, migration veya CI yapılandırması değiştirilmez.

## İlk kurulum

1. Settings → Secrets and variables → Actions → New repository secret:
   - Name: `SNAPLET_DATABASE_URL`
   - Secret: Supabase **Connect → Session pooler → URI** bağlantısı. `[YOUR-PASSWORD]` yerine DB parolası doldurulur. Parolanın URI özel karakterleri percent-encode edilir. Port **5432** olmalı.
2. Actions → **Snaplet SQL preview** → Run workflow → main. `pilot3` ilk üç öğrenci, `expand7` yedi farklı öğrenci üretir. Her çalıştırma yeni kimlikler üretir; tekrar yüklemeden önce manifest kontrol edilir.
3. Başarılı koşunun `snaplet-preview-…` artifact'ını indir.

Proje HTTPS URL'si ve publishable/service-role anahtarı PostgreSQL bağlantısı değildir. Secret oluşturmak DB parolasını sıfırlamayı gerektirmez. Mevcut parolayı bilmiyorsan sıfırlamanın diğer bağlantılara etkisini önce değerlendir.

## Ne yapar?

- Yalnız hedef proje `gwyprhenabtpkbojephw` ve session/direct 5432 bağlantısını kabul eder.
- Starter1 / Starter1 Merkez adlı tek aktif kapsamı salt okunur doğrular.
- Snaplet 0.98.0 ile güncel şemayı okur. Yalnız üç hedef tablonun scalar kolonlarını içeren bir üretim projeksiyonu hazırlar; FK kolonlarının değerleri açık verilir. Böylece mevcut kuruluş/merkez satırları yeniden üretilmez ve döngüsel ebeveyn grafiği üretimi kilitlemez. Bu, veritabanı şemasını veya FK/trigger kontrollerini değiştirmez. AI servisi kullanılmaz.
- Seçilen profile göre 3 veya 7 sentetik kişi, örnek e-posta ve aktif öğrenci ilişkisi için `dryRun` SQL üretir.
- Domain UUID'leri v7, sürümler 1, adresler `example.invalid`; mevcut kullanıcı verisi kopyalanmaz.
- Veritabanı bağlantısı salt okunur, TLS sertifika doğrulaması açık kalır. Ham sağlayıcı hataları/logları yayımlanmaz.
- Supabase kök CA sertifikası `certs/supabase-root.crt` içinde sabittir. Bu public sertifika hem ön bağlantıda hem Snaplet adapter'ında kullanılır; sunucu adı doğrulaması açıktır. Access token gerekmez.
- Artifact yalnız `preview.sql` ve sentetik kayıt kimliklerini içeren manifest içerir; 3 gün saklanır.

**Veri yüklemez.** SQL varsayılan olarak `BEGIN … SET CONSTRAINTS ALL IMMEDIATE … ROLLBACK` ile sarılıdır. Reset/TRUNCATE veya otomatik apply yok. Artifact yükleme kabulü değildir; sonraki kontrollü yükleme öncesi güncel kota, plan, yetki ve trigger yan etkileri incelenir. Rollback denemesi bile sequence veya dış trigger etkilerinin geri alındığını garanti etmez; hosted üzerinde körlemesine çalıştırılmaz.

Pilot finans, satış, rezervasyon, takvim, Auth hesabı ve davet gönderimi içermez. Öğrenci ekleme trigger'ının subscriber numarası üretimi gerçek yükleme sırasında ayrıca izlenmelidir. Aynı önizlemeyi tekrar üretmek yeni kimlikler oluşturur; henüz idempotent yükleme veya cleanup uygulaması yoktur.

## Doğrulama

`npm ci --ignore-scripts`, `npm test`, `npm run check`.
Push/main ve PR kontrolü izole loopback PostgreSQL servisinde Snaplet şema eşitleme → dryRun → üretilen SQL → rollback zincirini sınar. Basitleştirilmiş sentetik şema kullanır; gerçek FtkSaaS trigger/politika kabulü değildir. Bu kontrol hosted secret kullanmaz. DB önizlemesi yalnız elle başlatılır ve secret varlığı zorunludur; public repo desteklenir.
Kontrol ayrıca bilinen Supabase pooler'ına kimlik bilgisi/SQL göndermeyen iki TLS handshake yapar: ilgisiz CA reddedilmeli, Supabase CA ve sunucu adı doğrulanmalıdır. Bu kontrol DB parolasını veya schema erişimini kanıtlamaz.

## Durum

İlk üç öğrenciye yedi farklı öğrenci eklendi. Starter1 / Starter1 Merkez kapsamında toplam **10 demo öğrenci**, 10 aktif öğrenci ilişkisi ve 10 öğrenci numarası bağımsız SQL okumasıyla doğrulandı. Tümü Starter kapsamına dahil.

- [İlk pilot kaydı](runs/pilot-42205635117/receipt.json)
- [Yedi öğrenci genişletme kaydı](runs/expansion-42207875165/receipt.json)

SQL ve sentetik manifestler ilgili kayıt klasörlerindedir. Mevcut kayıt silinmedi, yeni outbox işi oluşmadı. Önizleme workflow'u salt okunur kalır; otomatik veri yüklemez.

**Ekran kabulü tamamlanmadı:** Öğrenciler sayfası hem genişletme öncesinde hem sonrasında, yenileme ve Demo aramasında “İşlem tamamlanamadı” hatası verdi. Veritabanı kabulü geçti; ekran hatasının kök nedeni doğrulanmadı. Uygulama kodu değiştirilmedi.

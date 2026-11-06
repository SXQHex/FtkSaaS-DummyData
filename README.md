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

Kabul edilen veri dağılımı yüklendi: **1 Business (2 merkez), 2 Pro (birer merkez), 3 Starter (birer merkez)**. Her merkezde mevcut kayıtlar dahil **50 aktif + 10 inaktif öğrenci** var; toplam 350 aktif, 70 inaktif öğrencilik. [Son doğrulama ve temizlik kaydı](runs/target420-20261106/receipt.json).

Tüm 420 öğrencinin hesap bağlantısı ve öğrenci numarası doğrulandı. Yeni hesaplar doğal ad-soyadlardan üretilmiş ASCII Gmail aliasları kullanır. Parolalar kaynaklarda, artifact veya bu public repoda tutulmaz. Mevcut hesapların parolaları değiştirilmedi. Native Auth gerçek parola girişi ve yeni bir organizasyon sahibinin `account_get_v1` / `organizations_list_v1` çağrıları başarılı; genişletilmiş veri için uygulama ekranı kabulü ayrıca yapılmadı.

56 eski test kişisi ve bağlı 636 kayıt, kullanıcının tüm ilişkili test verilerini silme talebiyle temizlendi. Kişi/satış/borç/kredi/işlem/bildirim/önizleme bağlantıları tarandı. İki append-only koruması yalnız tek transaction içinde, tablolar kilitliyken bakım için geçici kapatıldı; transaction tamamlanmadan yeniden açıldı. Bağlı veriler önceden özel yedeklendi; public repoya kişisel envanter veya parola eklenmedi. Eşzamanlı Pro1 sahibi öğrenciliği korundu; bu çalışmada oluşturulan kullanılmamış bir demo hesabının 11 kaydı geri alındı. Son sayım tüm merkezlerde tam 50/10.

## 420 öğrencilik çalışma aracı

`target420.mjs`, bu görevin başlangıç envanteri için bağımsız bir uzlaştırma planlayıcısıdır. Uygulama deposuna veya CI'ına bağlı değildir; otomatik veri yüklemez. `.work/target420/before.json` ve `context.json` özel başlangıç snapshot'larıdır; `node target420.mjs` yalnız özel plan/SQL üretir. Kimlikler her üretimde yenilenir. Yükleme başladıktan sonra plan tekrar üretilmez; güncel DB envanteri ve bağlantılar yeniden incelenmeden tekrar çalıştırılmaz.

Native e-posta Auth test hesapları `authSql` ile runtime'da sağlanan parola kullanılarak hazırlanır. Hesap/identity/profil/kişi/iletişim projeksiyonu birlikte kurulur. Var olan hesap veya alias görüldüğünde işlem durur; parola güncellemesi yoktur. Geniş kapsamlı son temizlik, bu planlayıcının otomatik bir özelliği değildir; bağımlılıkları incelenmiş, özel ve tam kimlik listeli tek seferlik bakım işlemi olarak uygulandı.

İlk pilotların tarihsel kayıtları: [3 öğrenci](runs/pilot-42205635117/receipt.json), [7 öğrenci genişletme](runs/expansion-42207875165/receipt.json). Önizleme workflow'u salt okunur kalır.

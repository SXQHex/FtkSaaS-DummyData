# Supabase public CA

`supabase-root.crt` is a public CA certificate, not a private key or credential.

Source: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Retrieved: 2026-11-06. Subject: Supabase Root 2021 CA. Valid through 2031-04-26.

SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

The same explicit trust is used by the initial connection and the Snaplet adapter. Node certificate-chain and hostname verification stay enabled. No `rejectUnauthorized:false` or TLS verification bypass is used for hosted connections.

Documentation: https://supabase.com/docs/guides/platform/ssl-enforcement

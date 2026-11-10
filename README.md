<div align="center">

<img src="public/icon.svg" width="110" alt="FITYORA STORE">

# FITYORA STORE

**Digital Top Up & Online Store**

<img src="https://readme-typing-svg.demolab.com?font=Arial&size=18&duration=3000&pause=1000&color=22D3EE&center=true&vCenter=true&width=450&lines=Digital+Top+Up+Platform;Modern+Store+Management;Simple+and+Reliable+Service" alt="FITYORA Animation">

![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## Tentang FITYORA STORE

FITYORA STORE adalah platform layanan digital untuk pemesanan top-up game dan kebutuhan digital, dilengkapi katalog produk, checkout, invoice, pelacakan pesanan, dan dashboard Author.

## Fitur

- Katalog dan pengelolaan produk.
- Checkout dan pembuatan invoice.
- Pelacakan status pesanan.
- Akun pelanggan.
- Dashboard Author/Admin.
- Pengelolaan harga dan transaksi.

## Teknologi

- **Frontend:** React, Vite, TypeScript.
- **Backend:** Node.js, Express.
- **Database:** Supabase PostgreSQL.
- **Deployment:** Vercel.

## Menjalankan Proyek

```bash
npm install
cp .env.example .env     # isi DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev              # pengembangan lokal
npm test                 # tes otomatis
npm run build            # build produksi (dipakai Vercel)
```

Jangan pernah commit `.env`. Panduan deploy Vercel + Supabase lengkap: [docs/README-VERCEL-DEPLOY.md](./docs/README-VERCEL-DEPLOY.md).

## Dokumentasi

Dokumentasi teknis tersedia di folder [docs/](./docs/).

Riwayat fitur baru, perbaikan bug, dan perubahan versi dicatat dalam [PEMBARUAN.md](./PEMBARUAN.md).

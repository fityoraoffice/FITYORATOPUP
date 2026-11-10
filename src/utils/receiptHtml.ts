/** Struk pesanan & pembuat HTML email. Dipisah agar komponen modal bisa dimuat lazy. */
import { CAHYO_QRIS_DATA_URL, CAHYO_QRIS_INFO } from '../data/qrisMerchant';

export interface CompletedOrderReceipt {
  orderId: string;
  productName: string;
  itemName: string;
  targetId: string;
  paymentId: string;
  paymentName: string;
  paymentGroup: string;
  totalFormatted: string;
  whatsapp: string;
  email?: string;
  timestamp: string;
  waUrl: string;
}

/**
 * Generates a complete, self-contained HTML email receipt document from a CompletedOrderReceipt state.
 */
export function generateHtmlEmailReceipt(receipt: CompletedOrderReceipt): string {
  const escapeHtml = (value: unknown): string => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safeWaUrl = (() => {
    try {
      const parsed = new URL(receipt.waUrl);
      return parsed.protocol === 'https:' && parsed.hostname === 'wa.me' ? escapeHtml(parsed.href) : 'https://wa.me/';
    } catch { return 'https://wa.me/'; }
  })();
  const safe = {
    orderId: escapeHtml(receipt.orderId), productName: escapeHtml(receipt.productName),
    itemName: escapeHtml(receipt.itemName), targetId: escapeHtml(receipt.targetId),
    paymentName: escapeHtml(receipt.paymentName), paymentGroup: escapeHtml(receipt.paymentGroup),
    totalFormatted: escapeHtml(receipt.totalFormatted), whatsapp: escapeHtml(receipt.whatsapp),
    timestamp: escapeHtml(receipt.timestamp), merchantName: escapeHtml(CAHYO_QRIS_INFO.merchantName),
    nmid: escapeHtml(CAHYO_QRIS_INFO.nmid), waUrl: safeWaUrl
  };
  const recipientEmail = escapeHtml(receipt.email && receipt.email.trim() ? receipt.email.trim() : 'Pelanggan CahyoStore');
  const issuedDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice Pesanan ${safe.orderId} - CahyoStore</title>
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#020617;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#0f172a;border:1px solid rgba(34,211,238,0.3);border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);">
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#0891b2 0%,#7c3aed 55%,#059669 100%);padding:28px 24px;text-align:center;">
              <div style="display:inline-block;padding:5px 14px;border-radius:999px;background:rgba(2,6,23,0.45);color:#a5f3fc;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:10px;">
                RINGKASAN PESANAN • BUKAN BUKTI PEMBAYARAN
              </div>
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.4px;">
                CahyoStore <span style="font-weight:400;font-size:16px;opacity:0.9;">(FitYora Store)</span>
              </h1>
              <p style="margin:6px 0 0;font-size:12px;color:#e2e8f0;">
                Invoice pesanan Top Up Game &amp; Produk Digital
              </p>
            </td>
          </tr>

          <!-- Greeting & Status -->
          <tr>
            <td style="padding:24px 24px 12px;">
              <p style="margin:0 0 8px;font-size:13px;color:#cbd5e1;">
                Halo <strong style="color:#38bdf8;">${recipientEmail}</strong>,
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                Terima kasih telah bertransaksi di <strong>CahyoStore</strong>. Berikut adalah rincian invoice untuk pesanan Anda; dokumen ini bukan bukti pembayaran yang dibuat pada <strong>${issuedDate} (${safe.timestamp})</strong>:
              </p>
            </td>
          </tr>

          <!-- Order ID Highlight Box -->
          <tr>
            <td style="padding:8px 24px 16px;">
              <div style="background-color:#020617;border:1px dashed rgba(16,185,129,0.5);border-radius:16px;padding:16px;text-align:center;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:4px;">
                  ID Transaksi Unik
                </div>
                <div style="font-size:22px;font-weight:800;color:#22d3ee;letter-spacing:1.5px;font-family:monospace;">
                  ${safe.orderId}
                </div>
                <div style="margin-top:6px;display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(16,185,129,0.15);color:#34d399;font-size:11px;font-weight:700;">
                  Status: Menunggu Pembayaran • Belum Lunas
                </div>
              </div>
            </td>
          </tr>

          <!-- Transaction Details Table -->
          <tr>
            <td style="padding:0 24px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#1e293b;border-radius:16px;padding:16px;font-size:13px;">
                <tr>
                  <td style="padding:8px 4px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.06);">Produk / Layanan</td>
                  <td align="right" style="padding:8px 4px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);">${safe.productName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 4px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.06);">Item Nominal</td>
                  <td align="right" style="padding:8px 4px;color:#67e8f9;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);">${safe.itemName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 4px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.06);">Target / User ID</td>
                  <td align="right" style="padding:8px 4px;color:#ffffff;font-weight:700;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">${safe.targetId}</td>
                </tr>
                <tr>
                  <td style="padding:8px 4px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.06);">Metode Pembayaran</td>
                  <td align="right" style="padding:8px 4px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);">${safe.paymentName} (${safe.paymentGroup})</td>
                </tr>
                <tr>
                  <td style="padding:8px 4px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.06);">WhatsApp Pembeli</td>
                  <td align="right" style="padding:8px 4px;color:#e2e8f0;border-bottom:1px solid rgba(255,255,255,0.06);">${safe.whatsapp}</td>
                </tr>
                <tr>
                  <td style="padding:8px 4px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.06);">Email Penerima Struk</td>
                  <td align="right" style="padding:8px 4px;color:#38bdf8;border-bottom:1px solid rgba(255,255,255,0.06);">${recipientEmail}</td>
                </tr>
                <tr>
                  <td style="padding:12px 4px 4px;color:#f8fafc;font-weight:800;font-size:14px;">TOTAL PEMBAYARAN</td>
                  <td align="right" style="padding:12px 4px 4px;color:#34d399;font-weight:800;font-size:18px;">${safe.totalFormatted}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Official Merchant Info & CTA -->
          <tr>
            <td style="padding:0 24px 24px;text-align:center;">
              <div style="background-color:rgba(8,145,178,0.12);border:1px solid rgba(34,211,238,0.25);border-radius:14px;padding:12px;margin-bottom:18px;font-size:11px;color:#cbd5e1;">
                <strong>Informasi Merchant QRIS:</strong> ${safe.merchantName} • <strong>NMID:</strong> ${safe.nmid}
              </div>
              <a href="${safe.waUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 26px;border-radius:14px;background:linear-gradient(90deg,#10b981,#06b6d4);color:#020617;font-weight:800;font-size:13px;text-decoration:none;">
                Konfirmasi &amp; Kirim Bukti ke WhatsApp Admin →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#020617;padding:18px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#64748b;">
              <p style="margin:0 0 4px;">&copy; 2026 CahyoStore (FitYora Store) • Layanan Top Up Game &amp; Produk Digital</p>
              <p style="margin:0;">WhatsApp CS: 08139525985 • Instagram: @fityoraa</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

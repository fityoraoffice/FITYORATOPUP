/**
 * Smart Local AI Engine & Calculator Utility for CahyoStore
 * Provides instant responses, budget optimization, catalog matching,
 * and game winrate calculations.
 */

import { Product, ADMIN_WHATSAPP_NUMBER } from '../data/catalog';

export interface BotSuggestedAction {
  productId: string;
  productName: string;
  itemId: string;
  itemName: string;
  price: number;
  badge?: string;
  reason?: string;
}

export interface LocalAnalysisResult {
  reply: string;
  detectedOrderId?: string;
  suggestedProductId?: string;
  suggestedItemId?: string;
  suggestedLabel?: string;
  recommendations?: BotSuggestedAction[];
  openQris?: boolean;
  waLink?: string;
}

export interface BudgetOptimizationResult {
  comboTitle: string;
  savingNote: string;
  totalEstimated: number;
  remainingBudget: number;
  items: BotSuggestedAction[];
}

export interface WinrateResult {
  valid: boolean;
  neededWins: number;
  winsNeeded: number;
  message: string;
  isAchievable: boolean;
}

/**
 * Intelligent local natural language responder and intent detector
 */
export function fityBotAnalyzeAndReply(
  userText: string,
  products: Product[]
): LocalAnalysisResult {
  const query = (userText || '').trim();
  const lower = query.toLowerCase();

  // 1. Detect Order ID (e.g. CS-ABC1234 or CS-12345678)
  const orderIdMatch = query.match(/\b(CS-[A-Z0-9-]{5,35})\b/i);
  if (orderIdMatch) {
    const detectedId = orderIdMatch[1].toUpperCase();
    return {
      detectedOrderId: detectedId,
      reply: `Saya mendeteksi ID Pesanan *${detectedId}*. Sedang menghubungkan ke basis data server untuk memeriksa status pembayaran & pengiriman Anda...`,
      waLink: `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `Halo Admin CahyoStore, saya ingin menanyakan status pesanan saya: ${detectedId}`
      )}`
    };
  }

  // 2. Customer Service / WhatsApp / Author Help
  if (
    lower.includes('admin') ||
    lower.includes('author') ||
    lower.includes('kontak') ||
    lower.includes('hubungi') ||
    lower.includes('cs') ||
    lower.includes('whatsapp') ||
    lower.includes('nomor wa') ||
    lower.includes('komplain') ||
    lower.includes('bantuan') ||
    lower.includes('kendala')
  ) {
    return {
      waLink: `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        'Halo Admin CahyoStore, saya butuh bantuan langsung mengenai transaksi / layanan top-up.'
      )}`,
      reply:
        `Author & Customer Service resmi **CahyoStore** siap membantu Anda setiap hari melalui WhatsApp resmi di nomor **${ADMIN_WHATSAPP_NUMBER}** (CAHYO). Anda juga dapat klik tombol WhatsApp di bawah ini untuk tersambung secara instan.`
    };
  }

  // 3. Payment / QRIS / Transfer Guides
  if (
    lower.includes('qris') ||
    lower.includes('bayar') ||
    lower.includes('cara bayar') ||
    lower.includes('metode bayar') ||
    lower.includes('metode pembayaran') ||
    lower.includes('gopay') ||
    lower.includes('bca') ||
    lower.includes('dana') ||
    lower.includes('ovo') ||
    lower.includes('shopeepay') ||
    lower.includes('transfer bank')
  ) {
    return {
      openQris: true,
      reply:
        'CahyoStore mendukung metode pembayaran terlengkap dan instan:\n\n' +
        '1. **QRIS Resmi GoPay Merchant (NMID: ID1026469444966)**: Mendukung scan dari **semua e-wallet** (GoPay, DANA, OVO, ShopeePay, LinkAja) dan **Mobile Banking** (BCA, Mandiri, BRI, BNI, CIMB, BSI).\n' +
        '2. **Transfer E-Wallet Langsung**: GoPay, DANA, OVO, ShopeePay ke akun merchant resmi.\n\n' +
        'Pembayaran QRIS saat ini diperiksa manual oleh Author melalui aplikasi GoPay Merchant. Status pembayaran tidak otomatis terverifikasi. Pastikan invoice berhasil tersimpan di server sebelum melakukan pembayaran.'
    };
  }

  // 4. How to Order / Guide / Langkah Top Up
  if (
    lower.includes('cara order') ||
    lower.includes('cara beli') ||
    lower.includes('cara top up') ||
    lower.includes('cara topup') ||
    lower.includes('gimana beli') ||
    lower.includes('gimana cara') ||
    lower.includes('langkah') ||
    lower.includes('tutorial')
  ) {
    return {
      reply:
        'Berikut 4 langkah mudah top up di **CahyoStore**:\n\n' +
        '1. **Pilih Layanan**: Klik salah satu game atau layanan digital di katalog.\n' +
        '2. **Isi Data Akun**: Masukkan User ID / Nomor Tujuan (contoh: ID MLBB + Server, No. HP Pulsa, atau No. Meter PLN).\n' +
        '3. **Pilih Nominal**: Klik pilihan item atau paket yang diinginkan.\n' +
        '4. **Pilih Metode Pembayaran**: Pilih QRIS atau E-Wallet, lalu klik **Beli & Bayar Sekarang** untuk mendapatkan rincian transaksi & kode QR.'
    };
  }

  // 5. Speed, Guarantee, Safety, Legitimacy
  if (
    lower.includes('aman') ||
    lower.includes('legal') ||
    lower.includes('berapa lama') ||
    lower.includes('kapan masuk') ||
    lower.includes('proses berapa') ||
    lower.includes('garansi') ||
    lower.includes('terpercaya')
  ) {
    return {
      reply:
        '**CahyoStore 100% Aman & Legal Bergaransi Resmi!**\n\n' +
        '• **Kecepatan**: Transaksi diproses dalam **1 – 3 menit** setelah konfirmasi pembayaran.\n' +
        '• **Keamanan**: Diamond / saldo langsung masuk ke akun tanpa memerlukan kata sandi / password akun Anda (hanya butuh User ID/Nomor).\n' +
        '• **Garansi**: Full guarantee 100% uang kembali atau pengiriman ulang jika ada gangguan server resmi.'
    };
  }

  // 6. Comprehensive Product Mapping for all 28+ Catalog Services
  const aliasMap: Record<string, string> = {
    // Mobile Games
    ml: 'mlbb',
    mlbb: 'mlbb',
    'mobile legend': 'mlbb',
    'mobile legends': 'mlbb',
    diamond: 'mlbb',
    dm: 'mlbb',
    'weekly pass': 'mlbb',
    'twilight pass': 'mlbb',

    ff: 'ff',
    freefire: 'ff',
    'free fire': 'ff',
    booyah: 'ff',
    ffmax: 'ffmax',
    'free fire max': 'ffmax',

    pubg: 'pubg',
    pubgm: 'pubg',
    'pubg mobile': 'pubg',
    uc: 'pubg',

    roblox: 'roblox',
    robux: 'roblox',
    rbx: 'roblox',

    hok: 'hok',
    'honor of kings': 'hok',
    'honor of king': 'hok',

    codm: 'codm',
    'call of duty': 'codm',
    'cod mobile': 'codm',
    cp: 'codm',

    genshin: 'genshin',
    gi: 'genshin',
    'genshin impact': 'genshin',
    welkin: 'genshin',
    genesis: 'genshin',

    hsr: 'hsr',
    'honkai star rail': 'hsr',
    'star rail': 'hsr',
    oneiric: 'hsr',

    zzz: 'zzz',
    zenless: 'zzz',
    'zenless zone zero': 'zzz',
    monochrome: 'zzz',

    supersus: 'supersus',
    'super sus': 'supersus',
    goldstar: 'supersus',

    fcmobile: 'fcmobile',
    'fc mobile': 'fcmobile',
    fifa: 'fcmobile',
    'fc point': 'fcmobile',

    efootball: 'efootball',
    pes: 'efootball',
    'efootball coin': 'efootball',

    // PC Games
    valorant: 'valorant',
    valo: 'valorant',
    vp: 'valorant',
    'riot point': 'valorant',

    pointblank: 'pointblank',
    pb: 'pointblank',
    'pb cash': 'pointblank',
    zepetto: 'pointblank',

    steam: 'steam',
    'steam wallet': 'steam',
    dota: 'steam',
    csgo: 'steam',

    psn: 'psn',
    playstation: 'psn',
    'ps plus': 'psn',

    gplay: 'gplay',
    'google play': 'gplay',
    playstore: 'gplay',

    // Digital Services & Utilities
    pln: 'pln',
    listrik: 'pln',
    token: 'pln',
    'token pln': 'pln',
    'token listrik': 'pln',
    meteran: 'pln',
    idpel: 'pln',

    pulsa: 'pulsa',
    telkomsel: 'pulsa',
    indosat: 'pulsa',
    im3: 'pulsa',
    xl: 'pulsa',
    axis: 'pulsa',
    tri: 'pulsa',
    smartfren: 'pulsa',

    paketdata: 'paketdata',
    kuota: 'paketdata',
    internet: 'paketdata',
    'paket data': 'paketdata',

    ewallet: 'ewallet',
    'e-wallet': 'ewallet',
    saldo: 'ewallet',

    // Streaming & Lifestyle
    netflix: 'netflix',
    netflik: 'netflix',
    spotify: 'spotify',
    ytprem: 'ytprem',
    'youtube premium': 'ytprem',
    canva: 'canva',
    'canva pro': 'canva',
    vidio: 'vidio',
    'vidio platinum': 'vidio',

    // Sosmed
    tiktok: 'tiktok',
    'koin tiktok': 'tiktok',
    'tiktok coin': 'tiktok',
    igofficial: 'igofficial',
    instagram: 'igofficial',
    followers: 'igofficial'
  };

  let targetProdId = '';
  for (const [key, prodId] of Object.entries(aliasMap)) {
    if (lower.includes(key)) {
      targetProdId = prodId;
      break;
    }
  }

  // Exact or partial product name match fallback
  let matchedProduct: Product | undefined;
  if (targetProdId) {
    matchedProduct = products.find((p) => p.id === targetProdId);
  }
  if (!matchedProduct) {
    matchedProduct = products.find(
      (p) =>
        lower.includes(p.name.toLowerCase()) ||
        lower.includes(p.publisher.toLowerCase()) ||
        lower.includes(p.id.toLowerCase())
    );
  }

  // If a specific product was matched
  if (matchedProduct && matchedProduct.items.length > 0) {
    const availableItems = matchedProduct.items.filter((item) => Number.isFinite(item.price) && item.price > 0);
    if (availableItems.length === 0) {
      return { reply: `Harga ${matchedProduct.name} belum ditetapkan Author. Silakan cek kembali nanti atau hubungi WhatsApp Admin ${ADMIN_WHATSAPP_NUMBER}.` };
    }
    // Check if user requested a specific nominal or budget (e.g. 50rb, 100k, 20rb, mingguan, pass)
    const budgetExtract = lower.match(/(\d+)\s*(rb|ribu|k)?/);
    let requestedBudget = 0;
    if (budgetExtract) {
      const num = parseInt(budgetExtract[1], 10);
      const unit = budgetExtract[2];
      requestedBudget = unit === 'k' || unit === 'rb' || unit === 'ribu' ? num * 1000 : num < 1000 ? num * 1000 : num;
    }

    let recommendedItem = availableItems[0];
    if (requestedBudget > 0) {
      // Find closest item under or around budget
      const underBudget = availableItems.filter((i) => i.price <= requestedBudget * 1.15);
      if (underBudget.length > 0) {
        underBudget.sort((a, b) => b.price - a.price);
        recommendedItem = underBudget[0];
      }
    } else if (lower.includes('pass') || lower.includes('mingguan') || lower.includes('weekly')) {
      const passItem = availableItems.find((i) => /pass|mingguan|weekly|membership/i.test(i.name));
      if (passItem) recommendedItem = passItem;
    } else {
      // Best-seller or medium popular nominal
      const best = availableItems.find((i) => (i as any).tag === 'best-seller');
      recommendedItem = best || availableItems[Math.min(2, availableItems.length - 1)];
    }

    const priceListText = availableItems
      .slice(0, 4)
      .map((it) => `• ${it.name}: **Rp ${it.price.toLocaleString('id-ID')}**`)
      .join('\n');

    const suggestedActions: BotSuggestedAction[] = availableItems.slice(0, 3).map((it) => ({
      productId: matchedProduct!.id,
      productName: matchedProduct!.name,
      itemId: it.id,
      itemName: it.name,
      price: it.price,
      badge: it.id === recommendedItem.id ? 'Rekomendasi Utama' : undefined,
      reason: it.id === recommendedItem.id ? 'Paling populer & bernilai tinggi' : undefined
    }));

    return {
      reply:
        `Berikut informasi katalog resmi untuk **${matchedProduct.name}** (${matchedProduct.publisher}):\n\n` +
        `${priceListText}\n\n` +
        `Rekomendasi terbaik saat ini: **${recommendedItem.name}** seharga **Rp ${recommendedItem.price.toLocaleString('id-ID')}**.\n` +
        `Klik tombol di bawah untuk langsung membuka formulir pemesanan:`,
      suggestedProductId: matchedProduct.id,
      suggestedItemId: recommendedItem.id,
      suggestedLabel: `Pilih ${recommendedItem.name} (Rp ${recommendedItem.price.toLocaleString('id-ID')})`,
      recommendations: suggestedActions
    };
  }

  // Budget query across entire store if no specific product was named (e.g. "budget 50rb dapet apa")
  const genericBudgetMatch = lower.match(/(?:budget|uang|dana|saldo|punya)\s*(\d+)\s*(rb|ribu|k)?/);
  if (genericBudgetMatch) {
    const rawVal = parseInt(genericBudgetMatch[1], 10);
    const unit = genericBudgetMatch[2];
    const targetBudget = unit === 'k' || unit === 'rb' || unit === 'ribu' ? rawVal * 1000 : rawVal < 1000 ? rawVal * 1000 : rawVal;

    const optResult = recommendItemsForTargetBudget(targetBudget, null, products);
    if (optResult.items.length > 0) {
      const topPicks = optResult.items.map((it) => `• **${it.productName}** - ${it.itemName} (Rp ${it.price.toLocaleString('id-ID')})`).join('\n');
      return {
        reply:
          `Dengan anggaran **Rp ${targetBudget.toLocaleString('id-ID')}**, berikut pilihan paket terbaik yang bisa Anda dapatkan:\n\n` +
          `${topPicks}\n\n` +
          `${optResult.savingNote}`,
        suggestedProductId: optResult.items[0].productId,
        suggestedItemId: optResult.items[0].itemId,
        suggestedLabel: `Pilih ${optResult.items[0].productName} (${optResult.items[0].itemName})`,
        recommendations: optResult.items
      };
    }
  }

  // Default helpful response
  return {
    reply:
      'Maaf, saya belum bisa memahami pertanyaan itu dari informasi toko yang tersedia.\n\n' +
      'Saya tetap bisa membantu cek harga dari katalog, panduan pemesanan, status pesanan dengan ID transaksi, atau menghubungkan Anda ke WhatsApp Admin 08139525985. Untuk pertanyaan umum, coba tulis pertanyaan dengan kalimat yang lebih spesifik.'
  };
}

/**
 * Calculates item recommendations matching a user's exact budget
 */
export function recommendItemsForTargetBudget(
  budget: number,
  targetProduct: Product | null,
  allProducts: Product[]
): BudgetOptimizationResult {
  const safeBudget = Math.max(0, budget || 0);
  const pool: Array<{ product: Product; item: any }> = [];

  const candidateProducts = targetProduct ? [targetProduct] : allProducts;
  candidateProducts.forEach((p) => {
    p.items.forEach((item) => {
      if (item.price <= safeBudget && item.price > 0) {
        pool.push({ product: p, item });
      }
    });
  });

  // Sort by highest price <= budget
  pool.sort((a, b) => b.item.price - a.item.price);

  const selected: BotSuggestedAction[] = [];
  let currentSpend = 0;

  for (const entry of pool) {
    if (currentSpend + entry.item.price <= safeBudget && selected.length < 3) {
      selected.push({
        productId: entry.product.id,
        productName: entry.product.name,
        itemId: entry.item.id,
        itemName: entry.item.name,
        price: entry.item.price,
        badge: entry.product.name,
        reason:
          entry.item.price > safeBudget * 0.7
            ? 'Maksimalisasi budget terbaik'
            : 'Kombinasi hemat & worth-it'
      });
      currentSpend += entry.item.price;
    }
  }

  const remaining = Math.max(0, safeBudget - currentSpend);
  const targetLabel = targetProduct ? targetProduct.name : 'Digital Multi-Katalog';

  return {
    comboTitle: `Kombinasi Rekomendasi Pintar (${targetLabel})`,
    savingNote:
      remaining > 0
        ? `Hemat Rp ${remaining.toLocaleString('id-ID')} dari anggaran Anda! Sisa dana dapat ditabung untuk top-up berikutnya.`
        : 'Anggaran teroptimasi 100% secara efisien tanpa biaya terbuang.',
    totalEstimated: currentSpend,
    remainingBudget: remaining,
    items: selected
  };
}

/**
 * Calculates winrate requirements for competitive gamers (MLBB, etc.)
 */
export function calculateTargetWinrate(
  totalMatches: number,
  currentWr: number,
  targetWr: number
): WinrateResult {
  if (totalMatches <= 0) {
    return {
      valid: false,
      neededWins: 0,
      winsNeeded: 0,
      message: 'Masukkan total pertandingan yang sudah dimainkan (minimal 1).',
      isAchievable: false
    };
  }

  if (targetWr >= 100) {
    return {
      valid: false,
      neededWins: 0,
      winsNeeded: 0,
      message: 'Target Winrate 100% tidak dapat dicapai jika sudah ada kekalahan sebelumnya.',
      isAchievable: false
    };
  }

  if (targetWr <= currentWr) {
    return {
      valid: true,
      neededWins: 0,
      winsNeeded: 0,
      message: `Winrate Anda saat ini (${currentWr}%) sudah mencapai atau melampaui target (${targetWr}%)! Pertahankan performa hebat ini.`,
      isAchievable: true
    };
  }

  const currentWins = (currentWr / 100) * totalMatches;
  const winsNeeded = Math.ceil(
    (targetWr * totalMatches - 100 * currentWins) / (100 - targetWr)
  );

  return {
    valid: true,
    neededWins: Math.max(0, winsNeeded),
    winsNeeded: Math.max(0, winsNeeded),
    message: `Anda memerlukan kemenangan beruntun (Win Streak) tanpa kalah sebanyak ${winsNeeded} pertandingan berturut-turut untuk mencapai ${targetWr}% WR.`,
    isAchievable: true
  };
}

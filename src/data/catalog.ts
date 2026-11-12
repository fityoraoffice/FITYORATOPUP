export interface ProductItem {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  publisher: string;
  category:
    | 'game'
    | 'pcgame'
    | 'streaming'
    | 'sosmed'
    | 'digital'
    | 'voucher'
    | 'ewallet'
    | 'pln';
  image: string;
  imageFit?: 'cover' | 'contain';
  hasZoneId: boolean;
  idLabel: string;
  zoneLabel?: string;
  items: ProductItem[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  group: string;
  fee: number;
  badge: string;
  isMaintenance?: boolean;
}

export const DEFAULT_MARGIN_PERCENT = 7;

export function calculateSellingPriceFromSupplier(
  supplierPrice: number,
  marginPercent: number = DEFAULT_MARGIN_PERCENT
): number {
  if (!supplierPrice || supplierPrice <= 0) return 0;
  return Math.round(supplierPrice * (1 + marginPercent / 100));
}

export function calculateSupplierPriceFromSelling(
  sellingPrice: number,
  marginPercent: number = DEFAULT_MARGIN_PERCENT
): number {
  if (!sellingPrice || sellingPrice <= 0) return 0;
  return Math.round(sellingPrice / (1 + marginPercent / 100));
}

/** Markup dari harga jual saat ini (bukan biaya supplier); tidak membulatkan ke Rp500. */
export function calculateMarkupFromCurrentPrice(currentPrice: number, marginPercent: number): number {
  if (!Number.isSafeInteger(currentPrice) || currentPrice <= 0) return 0;
  const safeMargin = Math.max(5, Math.min(10, Math.round(Number(marginPercent) || DEFAULT_MARGIN_PERCENT)));
  return Math.max(1, Math.round(currentPrice * (1 + safeMargin / 100)));
}

const toSvgUri = (svg: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.trim());

export function createArtworkSvg(title: string, subtitle: string, c1: string, c2: string, iconSvg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="115" fill="url(#bg)"/>
    <g transform="translate(256, 230) scale(1.6)">
      ${iconSvg}
    </g>
    <rect x="56" y="385" width="400" height="75" rx="20" fill="#07090e" fill-opacity="0.75" stroke="#ffffff" stroke-opacity="0.15"/>
    <text x="256" y="426" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="256" y="450" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="14" font-weight="700" fill="#00F0FF" text-anchor="middle" letter-spacing="2">${subtitle}</text>
  </svg>`;
  return toSvgUri(svg);
}

export const DEFAULT_PRODUCT_ARTWORKS: Record<string, string> = {
  mlbb: "https://play-lh.googleusercontent.com/MztmLpB1-_eFbHnqNzzvzl5zjiOH2BEb0D71uBxZYf_4BEmW3QEPWODhRtyqY7Qz4wRLwQ--Rg1RAjOFqtHSs-o=s256",
  ff: "https://play-lh.googleusercontent.com/cK-U0_B9GrnSy26SNISDuvU_hL4VggyqJ1J5V2oiuyVEfiGo7fzegdBjk0ejXPg3PKK5sPwumdLBbWv8KkBKLQ=s256",
  pubg: "https://play-lh.googleusercontent.com/Se7jR6A5R0Mk9ClaIguf46yi2K3k32JsqKb3gAtrktIh3JwnFfxrQRmG9GLvdMpbxbMrReUOxzDkStxGxNo-5Q=s256",
  roblox: "https://play-lh.googleusercontent.com/QqZj22aXblAyYDxLQw-Gg0ycW0QkKhrDnwqgERZU9BMRXZnMlgXfq-94sikG5mEpt_I0lzZxcUzfLblmQgwYzUE=s256",
  genshin: "https://play-lh.googleusercontent.com/PQEqjOxr-3uZaNHmWoQinLVQQ9fbSegMKXmqgFm5nGgagqC2REH-1er3BguYStWbH3YStijj5WH1DDlwPh2ehw=s256",
  hsr: "https://play-lh.googleusercontent.com/aWrGocSA7hEuk1qAPe7L4T57LvLKrwwH26cK2_LOqxRQMQX7j3uHYojC-EKWgYEV2PdrmE0ahqvvhLhXrAGk6Q=s256",
  hok: "https://play-lh.googleusercontent.com/hEm5NVeEv7UfFJaK8GZdfWe7p3DB_VvYx57qIEHbR0tMV_NToziH0Vbgd6CxLiWF-iURpAe-jsC_UGUDt0diPQ=s256",
  magicchess: "https://play-lh.googleusercontent.com/uCoc4iwT9cUgSVK47Zvnbyu10JDudzNnNkky-9Suz5tU9cGKat4A23YfohUXzJh-wnlz0VWI-G58XHBFM2OBdA=s256",
  codm: "https://play-lh.googleusercontent.com/qbOiSlyprOTjbV2_VrOrlhsxeSmxuNW1Ug0-BQglEdEh6hfZOUxg2FcxUCW9AXMwCxybgEBtyVAJY0ZUaM87=s256",
  fcmobile: "https://play-lh.googleusercontent.com/uT1JkXWK9pv1DWWOuVebnsbATHMZmhG4LUDkvoXne9H2MDF1im00_-U4taZPifIBpJ47sA0i8IoCh5aEVuUG5JI=s256",
  efootball: "https://play-lh.googleusercontent.com/jn-jaGEFUPiu0dBP9O6PjiRk-BCwFFLm0RdeOjLH-qLYjhHJlzNBMgl3Sah24htajj67_fdve-DzGsqmMUx1tqQ=s256",
  zzz: "https://play-lh.googleusercontent.com/N8j-t_IXvDvqFzN3U_19OJPIyAHHgljwVa7TMyCYpdRXRykalU3HKq9u9oPnzDXEkUOX1yyuX16yuWNDrUC_Uw=s256",
  pointblank: toSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="pb_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1f2937"/><stop offset="100%" stop-color="#0b0f17"/></linearGradient><radialGradient id="pb_glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.4"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="512" height="512" rx="112" fill="url(#pb_bg)"/><rect x="12" y="12" width="488" height="488" rx="100" fill="none" stroke="#ef4444" stroke-width="4" stroke-opacity="0.55"/><circle cx="256" cy="256" r="215" fill="url(#pb_glow)"/><g fill="none" stroke="#f8fafc" stroke-width="14" stroke-linecap="round"><circle cx="256" cy="236" r="104"/><circle cx="256" cy="236" r="10" fill="#ef4444" stroke="none"/><path d="M256 100v52M256 320v52M120 236h52M340 236h52" stroke="#ef4444"/></g><text x="256" y="440" font-family="Arial,sans-serif" font-size="46" font-weight="900" fill="#f8fafc" text-anchor="middle" letter-spacing="6">POINT BLANK</text></svg>`),
  supersus: "https://play-lh.googleusercontent.com/tAVkllG0IjoaIwE_NXDo8D7LPPonuyXhaD5JT002E3IM8gk5co26H4oC257MFI_bqhBi9zIMVTwxpQMhm7JFIXQ=s256",
  valorant: toSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="val_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#181e24"/><stop offset="50%" stop-color="#0f141a"/><stop offset="100%" stop-color="#05080c"/></linearGradient><linearGradient id="val_red" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff4655"/><stop offset="50%" stop-color="#fa4454"/><stop offset="100%" stop-color="#bd1827"/></linearGradient><radialGradient id="val_glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ff4655" stop-opacity="0.35"/><stop offset="60%" stop-color="#ff4655" stop-opacity="0.1"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/></radialGradient><filter id="val_shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#ff4655" flood-opacity="0.45"/></filter></defs><rect width="512" height="512" rx="112" fill="url(#val_bg)"/><rect x="12" y="12" width="488" height="488" rx="100" fill="none" stroke="#ff4655" stroke-width="4" stroke-opacity="0.5"/><circle cx="256" cy="256" r="215" fill="url(#val_glow)"/><g filter="url(#val_shadow)" transform="translate(256, 256)"><polygon points="-135,-120 -40,-120 40,40 -55,40" fill="url(#val_red)"/><polygon points="135,-120 55,-120 10,120 90,120" fill="#ece8e1"/><polygon points="-55,65 25,65 -15,125" fill="url(#val_red)"/></g></svg>`),
  steam: "https://play-lh.googleusercontent.com/E_x2GPSJakCdUYfECBptVyFoVnC4BxIPy3K4OdbwNyEtEJkRAY_J-Lo_Ltiybq6LiJ_aZCIzvqLv5h4Fbk91=s256",
  psn: toSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="ps_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#003791"/><stop offset="50%" stop-color="#00225c"/><stop offset="100%" stop-color="#00112e"/></linearGradient><radialGradient id="ps_glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#0070d1" stop-opacity="0.45"/><stop offset="70%" stop-color="#000000" stop-opacity="0"/></radialGradient><filter id="ps_shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.8"/></filter></defs><rect width="512" height="512" rx="112" fill="url(#ps_bg)"/><rect x="12" y="12" width="488" height="488" rx="100" fill="none" stroke="#0070d1" stroke-width="4" stroke-opacity="0.6"/><circle cx="256" cy="256" r="220" fill="url(#ps_glow)"/><g filter="url(#ps_shadow)" transform="translate(256, 256)"><polygon points="0,-125 -38,-65 38,-65" fill="none" stroke="#00e676" stroke-width="12" stroke-linejoin="round"/><circle cx="95" cy="0" r="32" fill="none" stroke="#ff3d71" stroke-width="12"/><line x1="-25" y1="70" x2="25" y2="120" stroke="#00b0ff" stroke-width="12" stroke-linecap="round"/><line x1="25" y1="70" x2="-25" y2="120" stroke="#00b0ff" stroke-width="12" stroke-linecap="round"/><rect x="-125" y="-30" width="60" height="60" rx="8" fill="none" stroke="#ff70a6" stroke-width="12"/><circle cx="0" cy="0" r="12" fill="#ffffff"/></g></svg>`),
  gplay: "https://play-lh.googleusercontent.com/3YayGH2tGgjk5NcwpJh0vB16C_bEX9GJ5EmUWI4kuEMd8b3Nh3zAgUtxL7rRHmyeEFSvnd6Af0lCyqICjZah7w=s256",
  netflix: "https://play-lh.googleusercontent.com/fXVS45nukV1x9PYVSKHkCQK0QGCOishIvAOxIZS3sgRem8HS7l9l94_Ggj-WZPrTLePRdNYN4pp4SPAQL7oS0PU=s256",
  spotify: "https://play-lh.googleusercontent.com/IzQgYCcnCFCD08GR-3bdtcT8xzOvrNkC84avGT5CwTX2VIqmTmKKJcP_Cd4JoBOdmCMlTndlOzV6hrthg2fOWA=s256",
  ytprem: "https://play-lh.googleusercontent.com/QNmuZQc9I6Zbe3mWnSr0hycnENqGFCI5p3yE29Hkxtf22T0IWS6zTrpxULLyyjWpB7ONAXDsDQXnXcVWokl3eg=s256",
  canva: "https://play-lh.googleusercontent.com/52fzAlhKzDyZV8ttyQ_DHB-jOeLZAZEdKlgXnWL__YNMZuvsoRCshJX5mr_ArFZjK7rte4hqEJ4ucjtuKJK5=s256",
  vidio: "https://play-lh.googleusercontent.com/SfWzLXzi9uSRLuy_tnmOrf3h7GFB_zQUcFU6S18l3UzyW1WoF9WqVa-tibyK8_AfXgvPLYMzbUQsRqaYBqCyVQ=s256",
  tiktok: "https://play-lh.googleusercontent.com/2o7iuqPe-0msP3DvNhzoOgNo4eZ6GkL_RtGVeKyBn5UBQAW5cw-GW5V3wDOHB1yTQuqWzrFLFOv2u4_5ea1uhg=s256",
  pulsa: "https://play-lh.googleusercontent.com/urOYiexeraZb6Eht8TLA4zqCV7WT7sOPOztH5M_LvFvFQ0cMcrAxFW9YlS0L-fZyBF_oTJ1KTYU_PSP2A_fp_Q=s256",
  pulsa_axis: "https://play-lh.googleusercontent.com/LdgB3Owd4IaNIO23ItF8XAPMXVuucN1Zt-AP0qXFZAdNdvXMVn6NgsBxFeGjRMjJZ0MyljAE50sF0r78PBrFtA=s256",
  pulsa_indosat: "https://play-lh.googleusercontent.com/My0pagSs_KtPOAxSUQTmjS3VLKbMaYkdmTx3b9aIQwcicM_IPH5HkIL6IhaqMlswH4JCGW2DNyEZHmKvmQMICGQ=s256",
  pulsa_telkomsel: "https://play-lh.googleusercontent.com/urOYiexeraZb6Eht8TLA4zqCV7WT7sOPOztH5M_LvFvFQ0cMcrAxFW9YlS0L-fZyBF_oTJ1KTYU_PSP2A_fp_Q=s256",
  pulsa_tri: "https://play-lh.googleusercontent.com/9MRm_-13BtjZr2KozWRZlCJNgDpHoZXTdDuMncm1Xa95E4wrTqU9MGWaK76EewNfPGDbYZ_8VmWmWYx-w1YjEAc=s256",
  pulsa_smartfren: "https://play-lh.googleusercontent.com/t1D5X5CIOoScxPcuzl54KQaBw4TIySYgi-GC05vUcmeLyhcsmwppJ8O_XHHQfGul7PZ9Zc-BPeSM59b1BOYj9cE=s256",
  pulsa_xl: "https://play-lh.googleusercontent.com/gIsX_ZOKxeTIzK-7Jiyeqt-XLnN0YoNtNBSuwMt7AL_ap24XdrTkESQFiCTYQHv49Js4Ycblva52bWVAAw7IMNc=s256",
  paketdata: "https://play-lh.googleusercontent.com/urOYiexeraZb6Eht8TLA4zqCV7WT7sOPOztH5M_LvFvFQ0cMcrAxFW9YlS0L-fZyBF_oTJ1KTYU_PSP2A_fp_Q=s256",
  ewallet: "https://play-lh.googleusercontent.com/3pjYaXJAV8Q05NwQbvsGCnkflnR8Sh_5xLoj92Uq5ptmnn2nbfp0WrCzKPPyI3eYpMz1f8mxd-RWm-1NrWzhPQ=s256",
  pln: "https://play-lh.googleusercontent.com/42cY-Bo9tf2_GPqUXmS44mU3m4oYV_6MtrYF_TPIHnMhf8MMeu4g33EhPQ6fR-g4JHrgdk1y48dQjIZ48Vbk8zs=s256",
  igofficial: "https://play-lh.googleusercontent.com/2o7iuqPe-0msP3DvNhzoOgNo4eZ6GkL_RtGVeKyBn5UBQAW5cw-GW5V3wDOHB1yTQuqWzrFLFOv2u4_5ea1uhg=s256"
};

export const INITIAL_PRODUCTS_DATA: Product[] = [
  {
    id: 'pulsa_axis',
    name: 'Pulsa Axis',
    publisher: 'Axis / XL Axiata',
    category: 'digital',
    image: DEFAULT_PRODUCT_ARTWORKS.pulsa_axis || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor HP Axis (08xxx)',
    items: [
      { id: 'paxs5', name: 'Axis 5.000 (PAXS5)', price: 6500 },
      { id: 'paxs10', name: 'Axis 10.000 (PAXS10)', price: 11500 },
      { id: 'paxs15', name: 'Axis 15.000 (PAXS15)', price: 16500 },
      { id: 'paxs20', name: 'Axis 20.000 (PAXS20)', price: 21500 },
      { id: 'paxs25', name: 'Axis 25.000 (PAXS25)', price: 26500 },
      { id: 'paxs30', name: 'Axis 30.000 (PAXS30)', price: 31500 },
      { id: 'paxs50', name: 'Axis 50.000 (PAXS50)', price: 51500 },
      { id: 'paxs100', name: 'Axis 100.000 (PAXS100)', price: 101000 },
    ]
  },
  {
    id: 'pulsa_indosat',
    name: 'Pulsa Indosat IM3',
    publisher: 'Indosat Ooredoo Hutchison',
    category: 'digital',
    image: DEFAULT_PRODUCT_ARTWORKS.pulsa_indosat || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor HP Indosat (08xxx)',
    items: [
      { id: 'pndst5', name: 'Indosat IM3 5.000 (PNDST5)', price: 6500 },
      { id: 'pndst10', name: 'Indosat IM3 10.000 (PNDST10)', price: 11500 },
      { id: 'pndst15', name: 'Indosat IM3 15.000 (PNDST15)', price: 16500 },
      { id: 'pndst20', name: 'Indosat IM3 20.000 (PNDST20)', price: 21500 },
      { id: 'pndst25', name: 'Indosat IM3 25.000 (PNDST25)', price: 26500 },
      { id: 'pndst30', name: 'Indosat IM3 30.000 (PNDST30)', price: 31500 },
      { id: 'pndst40', name: 'Indosat IM3 40.000 (PNDST40)', price: 41500 },
      { id: 'pndst50', name: 'Indosat IM3 50.000 (PNDST50)', price: 51500 },
      { id: 'pndst60', name: 'Indosat IM3 60.000 (PNDST60)', price: 61500 },
      { id: 'pndst80', name: 'Indosat IM3 80.000 (PNDST80)', price: 81500 },
      { id: 'pndst100', name: 'Indosat IM3 100.000 (PNDST100)', price: 101000 },
      { id: 'pndst125', name: 'Indosat IM3 125.000 (PNDST125)', price: 126000 },
      { id: 'pndst150', name: 'Indosat IM3 150.000 (PNDST150)', price: 151000 },
      { id: 'pndst200', name: 'Indosat IM3 200.000 (PNDST200)', price: 201000 },
      { id: 'pndst250', name: 'Indosat IM3 250.000 (PNDST250)', price: 251000 },
      { id: 'pndst300', name: 'Indosat IM3 300.000 (PNDST300)', price: 301000 },
      { id: 'pndst400', name: 'Indosat IM3 400.000 (PNDST400)', price: 401000 },
      { id: 'pndst500', name: 'Indosat IM3 500.000 (PNDST500)', price: 501000 },
    ]
  },
  {
    id: 'pulsa_telkomsel',
    name: 'Pulsa Telkomsel',
    publisher: 'PT Telkomsel Indonesia',
    category: 'digital',
    image: DEFAULT_PRODUCT_ARTWORKS.pulsa_telkomsel || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor HP Telkomsel (08xxx)',
    items: [
      { id: 'ptsel2', name: 'Telkomsel 2.000 (PTSEL2)', price: 3500 },
      { id: 'ptsel5', name: 'Telkomsel 5.000 (PTSEL5)', price: 6500 },
      { id: 'ptsel10', name: 'Telkomsel 10.000 (PTSEL10)', price: 11500 },
      { id: 'ptsel15', name: 'Telkomsel 15.000 (PTSEL15)', price: 16500 },
      { id: 'ptsel20', name: 'Telkomsel 20.000 (PTSEL20)', price: 21500 },
      { id: 'ptsel25', name: 'Telkomsel 25.000 (PTSEL25)', price: 26500 },
      { id: 'ptsel30', name: 'Telkomsel 30.000 (PTSEL30)', price: 31500 },
      { id: 'ptsel35', name: 'Telkomsel 35.000 (PTSEL35)', price: 36500 },
      { id: 'ptsel40', name: 'Telkomsel 40.000 (PTSEL40)', price: 41500 },
      { id: 'ptsel50', name: 'Telkomsel 50.000 (PTSEL50)', price: 51500 },
      { id: 'ptsel60', name: 'Telkomsel 60.000 (PTSEL60)', price: 61500 },
      { id: 'ptsel70', name: 'Telkomsel 70.000 (PTSEL70)', price: 71500 },
      { id: 'ptsel75', name: 'Telkomsel 75.000 (PTSEL75)', price: 76500 },
      { id: 'ptsel80', name: 'Telkomsel 80.000 (PTSEL80)', price: 81500 },
      { id: 'ptsel100', name: 'Telkomsel 100.000 (PTSEL100)', price: 101000 },
    ]
  },
  {
    id: 'pulsa_tri',
    name: 'Pulsa Tri (3)',
    publisher: 'Tri / IOH Indonesia',
    category: 'digital',
    image: DEFAULT_PRODUCT_ARTWORKS.pulsa_tri || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor HP Tri (08xxx)',
    items: [
      { id: 'ptri5', name: 'Tri (3) 5.000 (PTRI5)', price: 6500 },
      { id: 'ptri10', name: 'Tri (3) 10.000 (PTRI10)', price: 11500 },
      { id: 'ptri15', name: 'Tri (3) 15.000 (PTRI15)', price: 16500 },
      { id: 'ptri20', name: 'Tri (3) 20.000 (PTRI20)', price: 21500 },
      { id: 'ptri25', name: 'Tri (3) 25.000 (PTRI25)', price: 26500 },
      { id: 'ptri40', name: 'Tri (3) 40.000 (PTRI40)', price: 41500 },
      { id: 'ptri50', name: 'Tri (3) 50.000 (PTRI50)', price: 51500 },
      { id: 'ptri75', name: 'Tri (3) 75.000 (PTRI75)', price: 76500 },
      { id: 'ptri100', name: 'Tri (3) 100.000 (PTRI100)', price: 101000 },
      { id: 'ptri150', name: 'Tri (3) 150.000 (PTRI150)', price: 151000 },
      { id: 'ptri200', name: 'Tri (3) 200.000 (PTRI200)', price: 201000 },
      { id: 'ptri300', name: 'Tri (3) 300.000 (PTRI300)', price: 301000 },
      { id: 'ptri500', name: 'Tri (3) 500.000 (PTRI500)', price: 501000 },
    ]
  },
  {
    id: 'pulsa_smartfren',
    name: 'Pulsa Smartfren',
    publisher: 'PT Smartfren Telecom',
    category: 'digital',
    image: DEFAULT_PRODUCT_ARTWORKS.pulsa_smartfren || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor HP Smartfren (08xxx)',
    items: [
      { id: 'psmpn5', name: 'Smartfren 5.000 (PSMPN5)', price: 6500 },
      { id: 'psmpn10', name: 'Smartfren 10.000 (PSMPN10)', price: 11500 },
      { id: 'psmpn15', name: 'Smartfren 15.000 (PSMPN15)', price: 16500 },
      { id: 'psmpn20', name: 'Smartfren 20.000 (PSMPN20)', price: 21500 },
      { id: 'psmpn25', name: 'Smartfren 25.000 (PSMPN25)', price: 26500 },
      { id: 'psmpn30', name: 'Smartfren 30.000 (PSMPN30)', price: 31500 },
      { id: 'psmpn50', name: 'Smartfren 50.000 (PSMPN50)', price: 51500 },
      { id: 'psmpn60', name: 'Smartfren 60.000 (PSMPN60)', price: 61500 },
      { id: 'psmpn70', name: 'Smartfren 70.000 (PSMPN70)', price: 71500 },
      { id: 'psmpn75', name: 'Smartfren 75.000 (PSMPN75)', price: 76500 },
      { id: 'psmpn80', name: 'Smartfren 80.000 (PSMPN80)', price: 81500 },
      { id: 'psmpn100', name: 'Smartfren 100.000 (PSMPN100)', price: 101000 },
      { id: 'psmpn150', name: 'Smartfren 150.000 (PSMPN150)', price: 151000 },
      { id: 'psmpn200', name: 'Smartfren 200.000 (PSMPN200)', price: 201000 },
      { id: 'psmpn300', name: 'Smartfren 300.000 (PSMPN300)', price: 301000 },
      { id: 'psmpn400', name: 'Smartfren 400.000 (PSMPN400)', price: 401000 },
      { id: 'psmpn500', name: 'Smartfren 500.000 (PSMPN500)', price: 501000 },
    ]
  },
  {
    id: 'pulsa_xl',
    name: 'Pulsa XL Axiata',
    publisher: 'PT XL Axiata Tbk',
    category: 'digital',
    image: DEFAULT_PRODUCT_ARTWORKS.pulsa_xl || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor HP XL (08xxx)',
    items: [
      { id: 'ptxls5', name: 'XL Axiata 5.000 (PTXLS5)', price: 6500 },
      { id: 'ptlxs10', name: 'XL Axiata 10.000 (PTLXS10)', price: 11500 },
      { id: 'ptxls15', name: 'XL Axiata 15.000 (PTXLS15)', price: 16500 },
      { id: 'ptxls25', name: 'XL Axiata 25.000 (PTXLS25)', price: 26500 },
      { id: 'ptxls30', name: 'XL Axiata 30.000 (PTXLS30)', price: 31500 },
      { id: 'ptxls50', name: 'XL Axiata 50.000 (PTXLS50)', price: 51500 },
      { id: 'ptxls100', name: 'XL Axiata 100.000 (PTXLS100)', price: 101000 },
      { id: 'ptxls150', name: 'XL Axiata 150.000 (PTXLS150)', price: 151000 },
      { id: 'ptxls200', name: 'XL Axiata 200.000 (PTXLS200)', price: 201000 },
      { id: 'ptxls300', name: 'XL Axiata 300.000 (PTXLS300)', price: 301000 },
      { id: 'ptxls500', name: 'XL Axiata 500.000 (PTXLS500)', price: 501000 },
    ]
  },
  {
    id: 'pln',
    name: 'Token Listrik PLN',
    publisher: 'PT PLN (Persero) Prabayar',
    category: 'pln',
    image: DEFAULT_PRODUCT_ARTWORKS.pln || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'No. Meter / ID Pelanggan PLN',
    items: [
      { id: 'tknpln5', name: 'Token 5.000 (TKNPLN5)', price: 6500 },
      { id: 'tknpln20', name: 'Token 20.000 (TKNPLN20)', price: 21500 },
      { id: 'tknpln50', name: 'Token 50.000 (TKNPLN50)', price: 51500 },
      { id: 'tknpln100', name: 'Token 100.000 (TKNPLN100)', price: 101500 },
    ]
  },
  {
    id: 'codm',
    name: 'Call of Duty: Mobile',
    publisher: 'Garena',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.codm || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'OpenID / Player ID CODM',
    items: [
      { id: 'codm-31', name: '31 CP', price: 5000 },
      { id: 'codm-63', name: '63 CP', price: 10000 },
      { id: 'codm-128', name: '128 CP', price: 20000 },
      { id: 'codm-321', name: '321 CP', price: 48000 },
      { id: 'codm-645', name: '645 CP', price: 95000 },
      { id: 'codm-800', name: '800 CP', price: 118000 },
      { id: 'codm-1373', name: '1373 CP', price: 190000 },
      { id: 'codm-2060', name: '2060 CP', price: 285000 },
      { id: 'codm-2750', name: '2750 CP', price: 380000 },
      { id: 'codm-3564', name: '3564 CP', price: 490000 },
      { id: 'codm-5618', name: '5618 CP', price: 760000 },
      { id: 'codm-7656', name: '7656 CP', price: 1020000 },
      { id: 'codm-15312', name: '15312 CP', price: 2040000 },
      { id: 'codm-38280', name: '38280 CP', price: 5100000 },
      { id: 'codm-76560', name: '76560 CP', price: 10200000 },
    ]
  },
  {
    id: 'fcmobile',
    name: 'EA Sports FC Mobile',
    publisher: 'Electronic Arts',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.fcmobile || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'UID FC Mobile',
    items: [
      { id: 'fc-40', name: '40 FC Points', price: 7000 },
      { id: 'fc-100', name: '100 FC Points', price: 16000 },
      { id: 'fc-520', name: '520 FC Points', price: 79000 },
      { id: 'fc-1070', name: '1.070 FC Points', price: 155000 },
      { id: 'fc-2200', name: '2.200 FC Points', price: 315000 },
      { id: 'fc-5750', name: '5.750 FC Points', price: 790000 },
      { id: 'fc-12000', name: '12.000 FC Points', price: 1580000 },
    ]
  },
  {
    id: 'ff',
    name: 'Free Fire',
    publisher: 'Garena',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.ff || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Player ID Free Fire',
    items: [
      { id: 'ff-5', name: '5 Diamond', price: 1000 },
      { id: 'ff-20', name: '20 Diamond', price: 3500 },
      { id: 'ff-50', name: '50 Diamond', price: 7500 },
      { id: 'ff-55', name: '55 Diamond', price: 8000 },
      { id: 'ff-70', name: '70 Diamonds', price: 9800 },
      { id: 'ff-80', name: '80 Diamond', price: 11200 },
      { id: 'ff-100', name: '100 Diamond', price: 14000 },
      { id: 'ff-120', name: '120 Diamond', price: 16500 },
      { id: 'ff-130', name: '130 Diamond', price: 18000 },
      { id: 'ff-140', name: '140 Diamonds', price: 19500 },
      { id: 'ff-145', name: '145 Diamond', price: 20000 },
      { id: 'ff-150', name: '150 Diamond', price: 21000 },
      { id: 'ff-190', name: '190 Diamond', price: 26500 },
      { id: 'ff-200', name: '200 Diamond', price: 28000 },
      { id: 'ff-210', name: '210 Diamond', price: 29500 },
      { id: 'ff-wdp', name: 'Membership Mingguan', price: 28500 },
      { id: 'ff-280', name: '280 Diamond', price: 39000 },
      { id: 'ff-350', name: '350 Diamond', price: 48000 },
      { id: 'ff-355', name: '355 Diamonds', price: 49000 },
      { id: 'ff-425', name: '425 Diamond', price: 58000 },
      { id: 'ff-500', name: '500 Diamond', price: 68000 },
      { id: 'ff-545', name: '545 Diamond', price: 74000 },
      { id: 'ff-635', name: '635 Diamond', price: 86000 },
      { id: 'ff-mdp', name: 'Membership Bulanan', price: 88000 },
      { id: 'ff-720', name: '720 Diamond', price: 97000 },
      { id: 'ff-800', name: '800 Diamond', price: 108000 },
      { id: 'ff-860', name: '860 Diamond', price: 116000 },
      { id: 'ff-925', name: '925 Diamond', price: 125000 },
      { id: 'ff-930', name: '930 Diamond', price: 126000 },
      { id: 'ff-1000', name: '1000 Diamond', price: 135000 },
      { id: 'ff-1050', name: '1050 Diamond', price: 142000 },
      { id: 'ff-1075', name: '1075 Diamond', price: 145000 },
      { id: 'ff-1080', name: '1080 Diamond', price: 146000 },
      { id: 'ff-1440', name: '1440 Diamond', price: 194000 },
      { id: 'ff-2160', name: '2160 Diamonds', price: 290000 },
      { id: 'ff-2515', name: '2515 Diamond', price: 338000 },
      { id: 'ff-3600', name: '3600 Diamond', price: 482000 },
      { id: 'ff-4320', name: '4320 Diamond', price: 578000 },
      { id: 'ff-7290', name: '7290 Diamond', price: 970000 },
      { id: 'ff-36500', name: '36500 Diamond', price: 4850000 },
      { id: 'ff-73100', name: '73100 Diamond', price: 9700000 },
    ]
  },
  {
    id: 'genshin',
    name: 'Genshin Impact',
    publisher: 'HoYoverse',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.genshin || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: true,
    idLabel: 'UID Genshin Impact',
    zoneLabel: 'Server (Asia/America/Europe)',
    items: [
      { id: 'gi-60', name: '60 Genesis Crystals', price: 16000 },
      { id: 'gi-330', name: '300+30 Genesis Crystals', price: 79000 },
      { id: 'gi-1090', name: '980+110 Genesis Crystals', price: 249000 },
      { id: 'gi-2240', name: '1980+260 Genesis Crystals', price: 489000 },
      { id: 'gi-3880', name: '3280+600 Genesis Crystals', price: 799000 },
      { id: 'gi-8080', name: '6480+1600 Genesis Crystals', price: 1599000 },
    ]
  },
  {
    id: 'hok',
    name: 'Honor of Kings',
    publisher: 'Level Infinite / Tencent',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.hok || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'UID Honor of Kings',
    items: [
      { id: 'hok-16', name: '16 Tokens', price: 3500 },
      { id: 'hok-80', name: '80 Tokens', price: 16000 },
      { id: 'hok-wcard', name: 'Weekly Card', price: 16500 },
      { id: 'hok-240', name: '240 Tokens', price: 46000 },
      { id: 'hok-wcardp', name: 'Weekly Card Plus', price: 49000 },
      { id: 'hok-400', name: '400 Tokens', price: 76000 },
      { id: 'hok-560', name: '560 Tokens', price: 105000 },
      { id: 'hok-800', name: '800 Tokens', price: 150000 },
      { id: 'hok-1200', name: '1.200 Tokens', price: 225000 },
      { id: 'hok-4000', name: '4.000 Tokens', price: 740000 },
      { id: 'hok-8000', name: '8.000 Tokens', price: 1480000 },
    ]
  },
  {
    id: 'magicchess',
    name: 'Magic Chess Go Go',
    publisher: 'Moonton',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.magicchess || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: true,
    idLabel: 'User ID',
    zoneLabel: 'Zone ID',
    items: [
      { id: 'mc-5', name: '5 Diamonds', price: 1500 },
      { id: 'mc-12', name: '12 Diamonds', price: 3500 },
      { id: 'mc-19', name: '19 Diamonds', price: 5500 },
      { id: 'mc-28', name: '28 Diamonds', price: 8000 },
      { id: 'mc-44', name: '44 Diamonds', price: 12500 },
      { id: 'mc-59', name: '59 Diamonds', price: 16500 },
      { id: 'mc-85', name: '85 Diamonds', price: 23500 },
      { id: 'mc-170', name: '170 Diamonds', price: 46500 },
      { id: 'mc-240', name: '240 Diamonds', price: 65500 },
      { id: 'mc-296', name: '296 Diamonds', price: 80500 },
      { id: 'mc-408', name: '408 Diamonds', price: 111000 },
      { id: 'mc-568', name: '568 Diamonds', price: 154000 },
      { id: 'mc-875', name: '875 Diamonds', price: 236000 },
      { id: 'mc-2010', name: '2.010 Diamonds', price: 535000 },
      { id: 'mc-4830', name: '4.830 Diamonds', price: 1280000 },
    ]
  },
  {
    id: 'mlbb',
    name: 'Mobile Legends',
    publisher: 'Moonton',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.mlbb || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: true,
    idLabel: 'User ID',
    zoneLabel: 'Zone ID',
    items: [
      { id: 'ml-5', name: '5 Diamond', price: 1500 },
      { id: 'ml-12', name: '12 Diamond', price: 3500 },
      { id: 'ml-14', name: '14 Diamond', price: 4000 },
      { id: 'ml-19', name: '19 Diamond', price: 5500 },
      { id: 'ml-28', name: '28 Diamond', price: 8000 },
      { id: 'ml-42', name: '42 Diamond', price: 12000 },
      { id: 'ml-59', name: '59 Diamond', price: 16500 },
      { id: 'ml-70', name: '70 Diamond', price: 19500 },
      { id: 'ml-85', name: '85 Diamond', price: 23500 },
      { id: 'ml-wdp', name: 'Weekly Diamond Pass', price: 27500 },
      { id: 'ml-140', name: '140 Diamond', price: 38500 },
      { id: 'ml-170', name: '170 Diamond', price: 46500 },
      { id: 'ml-wdp2', name: 'Weekly Diamond Pass 2x', price: 55000 },
      { id: 'ml-240', name: '240 Diamond', price: 65500 },
      { id: 'ml-284', name: '284 Diamond', price: 77000 },
      { id: 'ml-296', name: '296 Diamond', price: 80500 },
      { id: 'ml-wdp3', name: 'Weekly Diamond Pass 3x', price: 82500 },
      { id: 'ml-355', name: '355 Diamond', price: 96500 },
      { id: 'ml-408', name: '408 Diamond', price: 111000 },
      { id: 'ml-wdp4', name: 'Weekly Diamond Pass 4x', price: 110000 },
      { id: 'ml-wdp5', name: 'Weekly Diamond Pass 5x', price: 137500 },
      { id: 'ml-568', name: '568 Diamond', price: 154000 },
      { id: 'ml-875', name: '875 Diamond', price: 236000 },
      { id: 'ml-2010', name: '2010 Diamond', price: 535000 },
      { id: 'ml-2976', name: '2976 Diamond', price: 790000 },
      { id: 'ml-4394', name: '4394 Diamond', price: 1160000 },
      { id: 'ml-4830', name: '4830 Diamond', price: 1280000 },
    ]
  },
  {
    id: 'pubg',
    name: 'PUBG Mobile',
    publisher: 'Tencent Games',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.pubg || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Character ID',
    items: [
      { id: 'pubg-30', name: '30 UC', price: 7500 },
      { id: 'pubg-60', name: '60 UC', price: 14500 },
      { id: 'pubg-120', name: '120 UC', price: 29000 },
      { id: 'pubg-180', name: '180 UC', price: 43500 },
      { id: 'pubg-240', name: '240 UC', price: 58000 },
      { id: 'pubg-325', name: '325 UC', price: 72000 },
      { id: 'pubg-445', name: '445 UC', price: 98000 },
      { id: 'pubg-565', name: '565 UC', price: 124000 },
      { id: 'pubg-660', name: '660 UC', price: 142000 },
      { id: 'pubg-780', name: '780 UC', price: 168000 },
      { id: 'pubg-900', name: '900 UC', price: 194000 },
      { id: 'pubg-1100', name: '1100 UC', price: 236000 },
      { id: 'pubg-1320', name: '1320 UC', price: 282000 },
      { id: 'pubg-1500', name: '1500 UC', price: 320000 },
      { id: 'pubg-1800', name: '1800 UC', price: 385000 },
      { id: 'pubg-2125', name: '2125 UC', price: 452000 },
      { id: 'pubg-2460', name: '2460 UC', price: 522000 },
      { id: 'pubg-2785', name: '2785 UC', price: 590000 },
      { id: 'pubg-3120', name: '3120 UC', price: 660000 },
      { id: 'pubg-3850', name: '3850 UC', price: 790000 },
      { id: 'pubg-4835', name: '4835 UC', price: 990000 },
      { id: 'pubg-6310', name: '6310 UC', price: 1290000 },
      { id: 'pubg-8100', name: '8100 UC', price: 1650000 },
    ]
  },
  {
    id: 'roblox',
    name: 'Roblox',
    publisher: 'Roblox Corp',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.roblox || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Username Roblox',
    items: [
      { id: 'rbx-50', name: '50 Robux', price: 10000 },
      { id: 'rbx-100', name: '100 Robux', price: 19000 },
      { id: 'rbx-200', name: '200 Robux', price: 37000 },
      { id: 'rbx-300', name: '300 Robux', price: 55000 },
      { id: 'rbx-400', name: '400 Robux', price: 72000 },
      { id: 'rbx-500', name: '500 Robux', price: 89000 },
      { id: 'rbx-1000', name: '1000 Robux', price: 175000 },
      { id: 'rbx-1500', name: '1500 Robux', price: 260000 },
      { id: 'rbx-2000', name: '2000 Robux', price: 345000 },
      { id: 'rbx-2500', name: '2500 Robux', price: 430000 },
    ]
  },
  {
    id: 'supersus',
    name: 'Super Sus',
    publisher: 'PiKPOK',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.supersus || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Space ID',
    items: [
      { id: 'ss-100', name: '100 Goldstar', price: 16000 },
      { id: 'ss-wcard', name: 'Weekly Card', price: 30000 },
      { id: 'ss-310', name: '310 Goldstar', price: 48000 },
      { id: 'ss-520', name: '520 Goldstar', price: 80000 },
      { id: 'ss-pass', name: 'Super Pass', price: 75000 },
      { id: 'ss-bundle', name: 'Super Pass Bundle', price: 145000 },
      { id: 'ss-1060', name: '1.060 Goldstar', price: 160000 },
      { id: 'ss-mcard', name: 'Monthly Card', price: 89000 },
      { id: 'ss-vip', name: 'Super VIP Card', price: 125000 },
      { id: 'ss-2180', name: '2.180 Goldstar', price: 320000 },
      { id: 'ss-5600', name: '5.600 Goldstar', price: 790000 },
    ]
  },
  {
    id: 'valorant',
    name: 'Valorant',
    publisher: 'Riot Games',
    category: 'pcgame',
    image: DEFAULT_PRODUCT_ARTWORKS.valorant || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Riot ID (Nama#TAG)',
    items: [
      { id: 'val-475', name: '475 VP', price: 58000 },
      { id: 'val-1000', name: '1.000 VP', price: 116000 },
      { id: 'val-1475', name: '1.475 VP', price: 172000 },
      { id: 'val-2050', name: '2.050 VP', price: 232000 },
      { id: 'val-3050', name: '3.050 VP', price: 340000 },
      { id: 'val-3650', name: '3.650 VP', price: 405000 },
    ]
  },
  {
    id: 'hsr',
    name: 'Honkai: Star Rail',
    publisher: 'HoYoverse',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.hsr || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: true,
    idLabel: 'UID Star Rail',
    zoneLabel: 'Server (Asia/America/Europe)',
    items: [
      { id: 'hsr-60', name: '60 Oneiric Shard', price: 16000 },
      { id: 'hsr-330', name: '330 Oneiric Shard', price: 79000 },
      { id: 'hsr-1090', name: '1090 Oneiric Shard', price: 249000 },
      { id: 'hsr-esp', name: 'Express Supply Pass', price: 75000 },
    ]
  },
  {
    id: 'efootball',
    name: 'eFootball Mobile',
    publisher: 'Konami',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.efootball || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Konami ID / Nomor WA',
    items: [
      { id: 'ef-130', name: '130 eFootball Coins', price: 20000 },
      { id: 'ef-300', name: '300 eFootball Coins', price: 46000 },
      { id: 'ef-550', name: '550 eFootball Coins', price: 79000 },
      { id: 'ef-1040', name: '1040 eFootball Coins', price: 148000 },
      { id: 'ef-2130', name: '2130 eFootball Coins', price: 295000 },
    ]
  },
  {
    id: 'zzz',
    name: 'Zenless Zone Zero',
    publisher: 'HoYoverse',
    category: 'game',
    image: DEFAULT_PRODUCT_ARTWORKS.zzz || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: true,
    idLabel: 'UID ZZZ',
    zoneLabel: 'Server (Asia/America)',
    items: [
      { id: 'zzz-60', name: '60 Monochrome', price: 16000 },
      { id: 'zzz-330', name: '330 Monochrome', price: 78000 },
      { id: 'zzz-1090', name: '1090 Monochrome', price: 245000 },
      { id: 'zzz-ikm', name: 'Inter-Knot Membership', price: 75000 },
    ]
  },
  {
    id: 'pointblank',
    name: 'Point Blank Zepetto',
    publisher: 'Zepetto Interactive',
    category: 'pcgame',
    image: DEFAULT_PRODUCT_ARTWORKS.pointblank || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'ID Akun Zepetto PB',
    items: [
      { id: 'pb-1200', name: '1.200 PB Cash', price: 11000 },
      { id: 'pb-2400', name: '2.400 PB Cash', price: 21000 },
      { id: 'pb-6000', name: '6.000 PB Cash', price: 51000 },
      { id: 'pb-12000', name: '12.000 PB Cash', price: 101000 },
      { id: 'pb-24000', name: '24.000 PB Cash', price: 200000 },
    ]
  },
  {
    id: 'steam',
    name: 'Steam Wallet IDR',
    publisher: 'Valve Corporation',
    category: 'pcgame',
    image: DEFAULT_PRODUCT_ARTWORKS.steam || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor WhatsApp (Kode dikirim via WA)',
    items: [
      { id: 'stm-12', name: 'Steam Wallet Rp 12.000', price: 14500 },
      { id: 'stm-45', name: 'Steam Wallet Rp 45.000', price: 50000 },
      { id: 'stm-60', name: 'Steam Wallet Rp 60.000', price: 66000 },
      { id: 'stm-90', name: 'Steam Wallet Rp 90.000', price: 98000 },
      { id: 'stm-120', name: 'Steam Wallet Rp 120.000', price: 130000 },
      { id: 'stm-250', name: 'Steam Wallet Rp 250.000', price: 268000 },
    ]
  },
  {
    id: 'psn',
    name: 'PlayStation Store (PSN)',
    publisher: 'Sony Interactive',
    category: 'pcgame',
    image: DEFAULT_PRODUCT_ARTWORKS.psn || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor WhatsApp (Kode Voucher PSN)',
    items: [
      { id: 'psn-100', name: 'Voucher PSN Rp 100.000 (Reg Indo)', price: 108000 },
      { id: 'psn-200', name: 'Voucher PSN Rp 200.000 (Reg Indo)', price: 212000 },
      { id: 'psn-400', name: 'Voucher PSN Rp 400.000 (Reg Indo)', price: 418000 },
      { id: 'psn-plus', name: 'PS Plus Essential 1 Bulan', price: 115000 },
    ]
  },
  {
    id: 'gplay',
    name: 'Google Play Store',
    publisher: 'Voucher Google Play',
    category: 'voucher',
    image: DEFAULT_PRODUCT_ARTWORKS.gplay || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor WhatsApp (kode dikirim via WA)',
    items: [
      { id: 'gplay-0', name: 'Voucher Rp10.000', price: 12000 },
      { id: 'gplay-1', name: 'Voucher Rp50.000', price: 53000 },
      { id: 'gplay-2', name: 'Voucher Rp100.000', price: 104000 },
      { id: 'gplay-3', name: 'Voucher Rp300.000', price: 308000 },
    ]
  },
  {
    id: 'ewallet',
    name: 'Saldo E-Wallet',
    publisher: 'DANA, OVO, GoPay, ShopeePay',
    category: 'ewallet',
    image: DEFAULT_PRODUCT_ARTWORKS.ewallet || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor E-Wallet (08xxx)',
    items: [
      { id: 'ewallet-0', name: 'Saldo DANA 20.000', price: 21500 },
      { id: 'ewallet-1', name: 'Saldo OVO 50.000', price: 51500 },
      { id: 'ewallet-2', name: 'Saldo GoPay 100.000', price: 101500 },
      { id: 'ewallet-3', name: 'Saldo ShopeePay 50.000', price: 51500 },
      { id: 'ewallet-4', name: 'Saldo DANA 100.000', price: 101500 },
      { id: 'ewallet-5', name: 'Saldo LinkAja 50.000', price: 51500 },
    ]
  },
  {
    id: 'netflix',
    name: 'Netflix Premium 4K',
    publisher: 'Langganan Streaming Resmi',
    category: 'streaming',
    image: DEFAULT_PRODUCT_ARTWORKS.netflix || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor WhatsApp / Email Akun',
    items: [
      { id: 'nf-1p1b', name: 'Netflix 1 Profile 1 Bulan (4K UHD)', price: 32000 },
      { id: 'nf-semi', name: 'Netflix Semi-Private 1 Bulan', price: 45000 },
      { id: 'nf-priv', name: 'Netflix Private 1 Akun (5 Profile)', price: 145000 },
      { id: 'nf-3bln', name: 'Netflix 1 Profile 3 Bulan (Garansi)', price: 89000 },
    ]
  },
  {
    id: 'spotify',
    name: 'Spotify Premium',
    publisher: 'Musik Tanpa Iklan & Offline',
    category: 'streaming',
    image: DEFAULT_PRODUCT_ARTWORKS.spotify || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Email Akun Spotify / Nomor WA',
    items: [
      { id: 'sp-1b', name: 'Spotify Premium 1 Bulan (Full Garansi)', price: 22000 },
      { id: 'sp-3b', name: 'Spotify Premium 3 Bulan (Individual)', price: 55000 },
      { id: 'sp-6b', name: 'Spotify Premium 6 Bulan', price: 99000 },
    ]
  },
  {
    id: 'ytprem',
    name: 'YouTube Premium',
    publisher: 'YouTube + YT Music Tanpa Iklan',
    category: 'streaming',
    image: DEFAULT_PRODUCT_ARTWORKS.ytprem || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Alamat Email Gmail Anda',
    items: [
      { id: 'yt-1b', name: 'YouTube Premium 1 Bulan (Invite Email)', price: 15000 },
      { id: 'yt-3b', name: 'YouTube Premium 3 Bulan (Individual)', price: 35000 },
      { id: 'yt-6b', name: 'YouTube Premium 6 Bulan (Garansi Penuh)', price: 65000 },
    ]
  },
  {
    id: 'canva',
    name: 'Canva Pro Designer',
    publisher: 'Akses Semua Elemen & Font Pro',
    category: 'streaming',
    image: DEFAULT_PRODUCT_ARTWORKS.canva || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Email Akun Canva Anda',
    items: [
      { id: 'cv-1b', name: 'Canva Pro 1 Bulan (Via Invite)', price: 12000 },
      { id: 'cv-6b', name: 'Canva Pro 6 Bulan (Full Garansi)', price: 35000 },
      { id: 'cv-1th', name: 'Canva Pro 1 Tahun (Best Seller)', price: 55000 },
    ]
  },
  {
    id: 'vidio',
    name: 'Vidio Premier Platinum',
    publisher: 'Liga Inggris, Timnas & Series',
    category: 'streaming',
    image: DEFAULT_PRODUCT_ARTWORKS.vidio || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor WhatsApp / Email Akun Vidio',
    items: [
      { id: 'vd-plat', name: 'Vidio Platinum 1 Bulan (All Device)', price: 35000 },
      { id: 'vd-epl', name: 'Vidio Diamond + Liga Inggris 1 Bulan', price: 69000 },
      { id: 'vd-1th', name: 'Vidio Platinum 1 Tahun', price: 245000 },
    ]
  },
  {
    id: 'tiktok',
    name: 'TikTok Coins & Gift Live',
    publisher: 'TikTok Official Coins',
    category: 'sosmed',
    image: DEFAULT_PRODUCT_ARTWORKS.tiktok || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Username TikTok (@username)',
    items: [
      { id: 'tt-70', name: '70 TikTok Coins', price: 15000 },
      { id: 'tt-350', name: '350 TikTok Coins', price: 72000 },
      { id: 'tt-700', name: '700 TikTok Coins', price: 142000 },
      { id: 'tt-1400', name: '1.400 TikTok Coins', price: 282000 },
      { id: 'tt-3500', name: '3.500 TikTok Coins', price: 695000 },
    ]
  },
  {
    id: 'igofficial',
    name: 'Suntik Followers & Likes',
    publisher: 'Instagram, TikTok & YouTube Booster',
    category: 'sosmed',
    image: DEFAULT_PRODUCT_ARTWORKS.igofficial || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Username / Link Postingan (Akun Jangan Privat)',
    items: [
      { id: 'sm-ig500', name: '500 Followers Instagram Aktif', price: 18000 },
      { id: 'sm-ig1000', name: '1.000 Followers Instagram + Garansi', price: 34000 },
      { id: 'sm-tt1000', name: '1.000 Followers TikTok Permanen', price: 35000 },
      { id: 'sm-like1k', name: '1.000 Likes + 10.000 Views Reels/TikTok', price: 15000 },
    ]
  },
  {
    id: 'paketdata',
    name: 'Paket Internet & Kuota Data',
    publisher: 'Telkomsel, XL, Indosat, Tri, Axis',
    category: 'digital',
    image: DEFAULT_PRODUCT_ARTWORKS.paketdata || DEFAULT_PRODUCT_ARTWORKS.mlbb,
    imageFit: 'cover',
    hasZoneId: false,
    idLabel: 'Nomor HP Tujuan (08xxx)',
    items: [
      { id: 'dt-10gb', name: 'Kuota Reguler 10 GB (30 Hari)', price: 32000 },
      { id: 'dt-25gb', name: 'Kuota Combo 25 GB (30 Hari)', price: 58000 },
      { id: 'dt-50gb', name: 'Kuota Super 50 GB (30 Hari)', price: 92000 },
      { id: 'dt-unli', name: 'Paket Unlimited Apps + 30 GB Utama', price: 115000 },
    ]
  },
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'qris', name: 'QRIS All Payment (BCA, DANA, GoPay, OVO, ShopeePay)', group: 'QRIS Manual', fee: 0, badge: 'Diperiksa Admin' },
  { id: 'gopay', name: 'GoPay (Transfer No. HP / Akun)', group: 'E-Wallet', fee: 0, badge: 'Transfer Manual', isMaintenance: false },
  { id: 'dana', name: 'DANA (Transfer No. HP / Akun)', group: 'E-Wallet', fee: 0, badge: 'Transfer Manual', isMaintenance: false },
  { id: 'ovo', name: 'OVO (Transfer No. HP / Akun)', group: 'E-Wallet', fee: 0, badge: 'Transfer Manual', isMaintenance: false },
  { id: 'shopeepay', name: 'ShopeePay (Transfer No. HP)', group: 'E-Wallet', fee: 0, badge: 'Transfer Manual', isMaintenance: false },
  { id: 'seabank', name: 'SeaBank (Transfer Bank Digital)', group: 'Bank Transfer', fee: 0, badge: 'Transfer Manual', isMaintenance: false },
  { id: 'bca_va', name: 'BCA Virtual Account', group: 'Virtual Account', fee: 0, badge: 'Belum tersedia', isMaintenance: true },
  { id: 'bri_va', name: 'BRI Virtual Account', group: 'Virtual Account', fee: 0, badge: 'Belum tersedia', isMaintenance: true },
  { id: 'mandiri_va', name: 'Mandiri Virtual Account', group: 'Virtual Account', fee: 0, badge: 'Belum tersedia', isMaintenance: true },
  { id: 'bni_va', name: 'BNI Virtual Account', group: 'Virtual Account', fee: 0, badge: 'Belum tersedia', isMaintenance: true }
];

export const ADMIN_WHATSAPP_NUMBER = '628139525985';

export const TESTIMONIALS: Array<{ service: string; quote: string; initial: string; name: string; role: string }> = [];

export type FaqCategoryTopic = 'Semua' | 'Pembayaran' | 'Proses Pesanan' | 'Akun' | 'Garansi & Promo';

export interface FaqItem {
  q: string;
  a: string;
  topic: Exclude<FaqCategoryTopic, 'Semua'>;
  linkText?: string;
  linkUrl?: string;
}

export const FAQ_TOPICS: { id: FaqCategoryTopic; label: string; badge: string }[] = [
  { id: 'Semua', label: 'Semua Topik', badge: 'Lengkap' },
  { id: 'Pembayaran', label: 'Pembayaran', badge: 'QRIS GoPay' },
  { id: 'Proses Pesanan', label: 'Proses Pesanan', badge: 'Diperiksa Admin' },
  { id: 'Akun', label: 'Akun', badge: 'ID & Member' },
  { id: 'Garansi & Promo', label: 'Garansi & Promo', badge: 'Bantuan Admin' }
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    topic: 'Pembayaran',
    q: 'Bagaimana cara pembayarannya?',
    a: 'Pembayaran tersedia melalui QRIS statis GoPay Merchant atau transfer manual GoPay, DANA, OVO, ShopeePay, dan SeaBank. Pastikan nama penerima serta nominal cocok sebelum menyelesaikan transfer. Pesanan menunggu pemeriksaan manual oleh Author; tidak ada konfirmasi pembayaran otomatis.'
  },
  {
    topic: 'Pembayaran',
    q: 'Apakah saya akan mendapatkan bukti struk pembayaran via Email?',
    a: 'Saat checkout, Anda dapat membuat/unduh ringkasan invoice HTML. Invoice ini dapat diunduh langsung setelah pesanan dibuat.'
  },
  {
    topic: 'Pembayaran',
    q: 'Apakah ada biaya tambahan saat membayar dengan QRIS atau E-Wallet?',
    a: 'Website tidak menambahkan biaya layanan (Gratis Biaya Admin Rp 0). Anda cukup mentransfer sesuai nominal yang tertera.'
  },
  {
    topic: 'Proses Pesanan',
    q: 'Berapa lama pesanan diproses?',
    a: 'Pesanan diproses secara instan (1-3 menit) setelah konfirmasi pembayaran.'
  },
  {
    topic: 'Proses Pesanan',
    q: 'Kalau diamond atau item tidak masuk bagaimana?',
    a: 'Hubungi admin via WhatsApp dengan menyertakan ID Transaksi (contoh: CS-12345). Admin siap membantu 24 jam nonstop dengan garansi 100% aman.'
  },
  {
    topic: 'Proses Pesanan',
    q: 'Bagaimana cara melacak status pesanan saya?',
    a: 'Klik tombol "Lacak Pesanan" di bagian atas website atau masukkan nomor ID Transaksi Unik Anda untuk memantau status terakhir yang tersimpan di server.'
  },
  {
    topic: 'Akun',
    q: 'Apakah aman? Data akun saya dijaga?',
    a: 'CahyoStore tidak pernah meminta kata sandi / password akun. Top up resmi legal 100% hanya memerlukan Player ID / User ID.'
  },
  {
    topic: 'Akun',
    q: 'Untuk Roblox, menggunakan User ID atau Username?',
    a: 'Untuk Roblox, masukkan Username akun Roblox kamu (bukan email atau display name). Pastikan username sudah benar agar Robux masuk dengan tepat.'
  },
  {
    topic: 'Akun',
    q: 'Apa keuntungan mendaftar akun Member di CahyoStore?',
    a: 'Member terdaftar mendapatkan kemudahan pengisian nomor WhatsApp & Email otomatis saat checkout, pencatatan riwayat transaksi terenkripsi, serta akses promo VIP.'
  },
  {
    topic: 'Garansi & Promo',
    q: 'Apakah bisa order dalam jumlah banyak (Reseller / Grosir)?',
    a: 'Bisa! Untuk pembelian grosir, turnamen komunitas, atau reseller, silakan hubungi WhatsApp Admin untuk mendapatkan harga kemitraan khusus.'
  },
  {
    topic: 'Garansi & Promo',
    q: 'Di mana saya bisa lihat testimoni dan info promo terbaru?',
    a: 'Ikuti WhatsApp Channel Fityora Store. Info flash sale, update produk baru, dan testimoni pelanggan dibagikan setiap hari di sana.',
    linkText: 'buka channel',
    linkUrl: 'https://whatsapp.com/channel/0029VbER557C6ZvauoBBor2w'
  }
];

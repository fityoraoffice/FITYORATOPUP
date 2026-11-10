import React from 'react';

interface PaymentMethodLogoProps {
  id: string;
  size?: 'sm' | 'md';
}

export const PaymentMethodLogo: React.FC<PaymentMethodLogoProps> = ({ id, size = 'md' }) => {
  const boxClass =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg text-[9px]'
      : 'w-10 h-10 rounded-xl text-[10px]';

  switch (id) {
    case 'qris':
      return (
        <div
          className={`${boxClass} bg-white border border-white/20 flex flex-col items-center justify-center shrink-0 shadow-sm overflow-hidden`}
        >
          <svg viewBox="0 0 36 36" className="w-6 h-6">
            <rect x="4" y="4" width="10" height="10" rx="1.5" fill="none" stroke="#0f172a" strokeWidth="2.4" />
            <rect x="7" y="7" width="4" height="4" fill="#ef4444" />
            <rect x="22" y="4" width="10" height="10" rx="1.5" fill="none" stroke="#0f172a" strokeWidth="2.4" />
            <rect x="25" y="7" width="4" height="4" fill="#0f172a" />
            <rect x="4" y="22" width="10" height="10" rx="1.5" fill="none" stroke="#0f172a" strokeWidth="2.4" />
            <rect x="7" y="25" width="4" height="4" fill="#0f172a" />
            <rect x="16" y="16" width="4" height="4" fill="#ef4444" />
            <path d="M22 22h4v4h-4zM28 22h4v10h-4zM22 28h4v4h-4z" fill="#0f172a" />
          </svg>
        </div>
      );

    case 'gopay':
      return (
        <div
          className={`${boxClass} bg-[#00AED6] border border-white/15 flex items-center justify-center shrink-0 shadow-sm`}
        >
          <svg viewBox="0 0 36 36" className="w-6 h-6">
            <rect x="5" y="9" width="26" height="18" rx="4" fill="#ffffff" />
            <circle cx="23" cy="18" r="3.2" fill="#00AED6" />
            <path d="M9 14h7M9 18h5" stroke="#00AED6" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'dana':
      return (
        <div
          className={`${boxClass} bg-[#118EEA] border border-white/15 flex items-center justify-center shrink-0 font-extrabold text-white tracking-tight shadow-sm`}
        >
          <div className="flex flex-col items-center leading-none">
            <svg viewBox="0 0 24 10" className="w-5 h-2.5 mb-0.5">
              <path
                d="M2 6 C6 2, 10 9, 14 5 C17 2, 20 7, 22 4"
                stroke="#ffffff"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[8px] font-black tracking-wider">DANA</span>
          </div>
        </div>
      );

    case 'ovo':
      return (
        <div
          className={`${boxClass} bg-[#4C3494] border border-white/15 flex items-center justify-center shrink-0 font-black text-white tracking-wider shadow-sm`}
        >
          <span>OVO</span>
        </div>
      );

    case 'shopeepay':
      return (
        <div
          className={`${boxClass} bg-[#EE4D2D] border border-white/15 flex items-center justify-center shrink-0 shadow-sm`}
        >
          <svg viewBox="0 0 36 36" className="w-6 h-6">
            <path
              d="M13 13V11a5 5 0 0 1 10 0v2h4l-1.5 15a2 2 0 0 1-2 1.8H12.5a2 2 0 0 1-2-1.8L9 13h4z"
              fill="#ffffff"
            />
            <path
              d="M15 11a3 3 0 0 1 6 0v2h-6v-2z"
              fill="#EE4D2D"
            />
            <text
              x="18"
              y="24.5"
              fontFamily="Arial, sans-serif"
              fontSize="9.5"
              fontWeight="900"
              fill="#EE4D2D"
              textAnchor="middle"
            >
              S
            </text>
          </svg>
        </div>
      );

    case 'seabank':
      return (
        <div
          className={`${boxClass} bg-gradient-to-tr from-[#EA580C] to-[#FB923C] border border-white/20 flex flex-col items-center justify-center shrink-0 font-black text-white shadow-sm`}
        >
          <span className="tracking-tighter text-[9px] leading-none font-extrabold">Sea</span>
          <span className="text-[7px] font-bold text-amber-200 tracking-wider">BANK</span>
        </div>
      );

    case 'bca_va':
    case 'bca':
      return (
        <div
          className={`${boxClass} bg-[#005BAA] border border-white/15 flex flex-col items-center justify-center shrink-0 font-black text-white shadow-sm`}
        >
          <span className="tracking-tight text-[10px] leading-none">BCA</span>
          <span className="text-[6px] font-semibold text-sky-200 tracking-widest mt-0.5">VA</span>
        </div>
      );

    case 'bri_va':
    case 'bri':
      return (
        <div
          className={`${boxClass} bg-[#00529C] border border-white/15 flex flex-col items-center justify-center shrink-0 font-black text-white shadow-sm`}
        >
          <span className="tracking-tight text-[10px] leading-none">BRI</span>
          <span className="text-[6px] font-bold text-orange-300 tracking-widest mt-0.5">VA</span>
        </div>
      );

    case 'mandiri_va':
    case 'mandiri':
      return (
        <div
          className={`${boxClass} bg-[#003D79] border border-white/15 flex flex-col items-center justify-center shrink-0 font-extrabold text-white shadow-sm`}
        >
          <span className="text-[8px] font-black tracking-wider text-amber-300 leading-none">
            MANDIRI
          </span>
          <span className="text-[6px] font-bold text-sky-200 tracking-widest mt-0.5">VA</span>
        </div>
      );

    case 'bni_va':
    case 'bni':
      return (
        <div
          className={`${boxClass} bg-[#F15A24] border border-white/15 flex flex-col items-center justify-center shrink-0 font-black text-white shadow-sm`}
        >
          <span className="tracking-tight text-[10px] leading-none">BNI</span>
          <span className="text-[6px] font-bold text-teal-200 tracking-widest mt-0.5">VA</span>
        </div>
      );

    default:
      return (
        <div
          className={`${boxClass} bg-slate-800 border border-white/10 flex items-center justify-center shrink-0 font-bold text-cyan-400`}
        >
          PAY
        </div>
      );
  }
};

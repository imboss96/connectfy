import React from 'react';

interface UTestLogoProps {
  className?: string;
  showSubtitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const UTestLogo: React.FC<UTestLogoProps> = ({
  className = '',
  showSubtitle = true,
  size = 'md'
}) => {
  const iconSize = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const fontSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className={`flex items-center space-x-2.5 select-none ${className}`}>
      {/* Real uTest Signature Cyan & Navy Icon Mark */}
      <div
        className={`${iconSize} rounded-xl bg-gradient-to-br from-[#00A3E0] to-[#007AFF] p-0.5 shadow-md shadow-[#00A3E0]/20 flex items-center justify-center shrink-0`}
      >
        <div className="w-full h-full bg-[#0B132B] rounded-[10px] flex items-center justify-center relative overflow-hidden">
          {/* Subtle cyan glow */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#00A3E0]/30 rounded-full blur-xs" />
          
          {/* Stylized lowercase 'u' with tester checkmark terminal */}
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Lowercase 'u' curve */}
            <path
              d="M6 7V13C6 16.3137 8.68629 19 12 19C15.3137 19 18 16.3137 18 13V7"
              stroke="#00A3E0"
              strokeWidth="2.75"
              strokeLinecap="round"
            />
            {/* Terminal QA checkmark accent */}
            <path
              d="M18 10L18 17"
              stroke="#38BDF8"
              strokeWidth="2.75"
              strokeLinecap="round"
            />
            <circle cx="18" cy="6" r="1.5" fill="#38BDF8" />
          </svg>
        </div>
      </div>

      {/* Wordmark with authentic cyan 'u' and crisp white 'Test' */}
      <div className="leading-none">
        <div className={`font-black tracking-tight flex items-baseline gap-0.5 ${fontSize}`}>
          <span className="text-[#00A3E0] font-black">u</span>
          <span className="text-white font-black">Test</span>
          <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 bg-[#00A3E0]/15 text-[#38BDF8] border border-[#00A3E0]/30 rounded tracking-wider uppercase">
            CrowdQA
          </span>
        </div>
        {showSubtitle && (
          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
            <span>by</span>
            <span className="text-[#007AFF] font-bold tracking-tight">Applause</span>
            <span className="text-slate-600">•</span>
            <span>Freelance Marketplace</span>
          </div>
        )}
      </div>
    </div>
  );
};

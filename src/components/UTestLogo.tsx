import React from 'react';

interface ConnectfyLogoProps {
  className?: string;
  showSubtitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ConnectfyLogo: React.FC<ConnectfyLogoProps> = ({
  className = '',
  size = 'md'
}) => {
  const dimensions = size === 'sm'
    ? 'h-[54px] w-[98px]'
    : size === 'lg'
      ? 'h-[92px] w-[166px]'
      : 'h-[70px] w-[126px]';

  return (
    <span className={`inline-flex items-center justify-center overflow-hidden rounded-lg bg-white ${className}`}>
      <img
        src="/connectfy-brand.svg"
        alt="Connectfy"
        className={`${dimensions} object-contain`}
      />
    </span>
  );
};

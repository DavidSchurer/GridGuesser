import React from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 24, className = "" }: IconProps) {
  const icons: Record<string, JSX.Element> = {
    // Power-up icons only
    clock: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    ),
    grid2x2: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="3" width="8" height="8" rx="1"></rect>
        <rect x="13" y="3" width="8" height="8" rx="1"></rect>
        <rect x="3" y="13" width="8" height="8" rx="1"></rect>
        <rect x="13" y="13" width="8" height="8" rx="1"></rect>
      </svg>
    ),
    nuke: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5" className={className}>
        {/* Nuclear bomb icon */}
        <path d="M12 2C10.9 2 10 2.9 10 4V6H14V4C14 2.9 13.1 2 12 2Z"></path>
        <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2"></circle>
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"></circle>
        <path d="M12 8L12 16M8 12L16 12" stroke="currentColor" strokeWidth="2"></path>
        <path d="M9.17 9.17L14.83 14.83M14.83 9.17L9.17 14.83" stroke="currentColor" strokeWidth="1.5" opacity="0.6"></path>
      </svg>
    ),
  };

  return icons[name] || null;
}


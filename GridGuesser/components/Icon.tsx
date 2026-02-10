import React from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 24, className = "" }: IconProps) {
  const icons: Record<string, JSX.Element> = {
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
        <path d="M12 2C10.9 2 10 2.9 10 4V6H14V4C14 2.9 13.1 2 12 2Z"></path>
        <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2"></circle>
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"></circle>
        <path d="M12 8L12 16M8 12L16 12" stroke="currentColor" strokeWidth="2"></path>
        <path d="M9.17 9.17L14.83 14.83M14.83 9.17L9.17 14.83" stroke="currentColor" strokeWidth="1.5" opacity="0.6"></path>
      </svg>
    ),
    // Fog of War - cloud/fog icon
    fog: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
        <path d="M16 17H7"></path>
        <path d="M17 21H9"></path>
      </svg>
    ),
    // Reveal Row/Column - horizontal lines icon
    revealLine: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="12" y1="3" x2="12" y2="21"></line>
      </svg>
    ),
    // Freeze - snowflake icon
    freeze: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="12" y1="2" x2="12" y2="22"></line>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        <line x1="19.07" y1="4.93" x2="4.93" y2="19.07"></line>
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3"></circle>
      </svg>
    ),
    // Peek / Magnifying Glass
    peek: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <circle cx="11" cy="11" r="3" fill="currentColor" opacity="0.3"></circle>
      </svg>
    ),
    // Keep existing non-power-up icons if any reference them
    gamepad: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="6" y1="12" x2="10" y2="12"></line>
        <line x1="8" y1="10" x2="8" y2="14"></line>
        <line x1="15" y1="13" x2="15.01" y2="13"></line>
        <line x1="18" y1="11" x2="18.01" y2="11"></line>
        <rect x="2" y="6" width="20" height="12" rx="2"></rect>
      </svg>
    ),
    target: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="6"></circle>
        <circle cx="12" cy="12" r="2"></circle>
      </svg>
    ),
    image: (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    ),
  };

  return icons[name] || null;
}

import React from 'react';
import { Link } from 'react-router-dom';
import sfcgLogo from '../assets/sfcg-logo.png';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

/**
 * Logo component for Search for Common Ground.
 * Bundled locally (src/assets/sfcg-logo.png) rather than hotlinked from
 * sfcg.org — the previous fallback URL was blocked by that site's CORS
 * policy in production (net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin).
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  // Target width per size; height is left to scale automatically (h-auto)
  // so the logo's real aspect ratio is always preserved.
  const widths = {
    sm: 120,   // Mobile
    md: 180,   // Tablet
    lg: 240,   // Desktop
    xl: 320,   // Large screens
  };

  const width = widths[size];

  return (
    <Link
      to="/"
      className={`inline-block transition-transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg p-1 ${className}`}
      aria-label="Search for Common Ground - Go to home"
    >
      <div className="flex items-center">
        <img
          src={sfcgLogo}
          alt="Search for Common Ground logo"
          width={width}
          className="h-auto object-contain"
          loading={size === 'sm' || size === 'md' ? 'eager' : 'lazy'}
        />
      </div>
    </Link>
  );
};

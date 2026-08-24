import React from 'react';
import { Link } from 'react-router-dom';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

/**
 * Optimized Logo component for Search for Common Ground
 * Handles responsiveness, accessibility, and performance
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ 
  className = '', 
  size = 'md',
  showText = true 
}) => {
  // Base path for optimized assets
  // These should be placed in /public/assets/ or src/assets/
  // Falling back to official high-quality URL for demo
  const fallbackUrl = "https://www.sfcg.org/wp-content/uploads/2023/10/Search-for-Common-Ground-Logo.png";
  
  // Dimensions based on size prop
  const dimensions = {
    sm: { width: 120, height: 40 },   // Mobile
    md: { width: 180, height: 60 },   // Tablet
    lg: { width: 240, height: 80 },   // Desktop
    xl: { width: 320, height: 100 }   // Large screens
  };

  const { width, height } = dimensions[size];

  // Note: In a production environment, we would use local optimized assets:
  // const srcSet = "/assets/logo-120.webp 120w, /assets/logo-180.webp 180w, /assets/logo-240.webp 240w, /assets/logo-480.webp 480w";
  
  return (
    <Link 
      to="/" 
      className={`inline-block transition-transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg p-1 ${className}`}
      aria-label="Search for Common Ground - Go to home"
    >
      <div className="flex items-center">
        <img 
          src={fallbackUrl}
          alt="Search for Common Ground logo"
          width={width}
          height={height}
          className="h-auto object-contain"
          loading={size === 'sm' || size === 'md' ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          // srcSet={srcSet} // Uncomment when assets are optimized and locally available
          // sizes="(max-width: 640px) 120px, (max-width: 1024px) 180px, 240px"
        />
      </div>
    </Link>
  );
};

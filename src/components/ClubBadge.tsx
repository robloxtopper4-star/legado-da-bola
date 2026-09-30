import React, { useState, useEffect } from 'react';
import { Club } from '../types';
import { INITIAL_CLUBS } from '../data/database';
import { getClubLogoSources } from '../utils/clubLogos';

interface ClubBadgeProps {
  club?: Partial<Club> | null;
  clubId?: string;
  logoUrl?: string;
  shortName?: string;
  name?: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showName?: boolean;
}

const sizeClasses = {
  xs: {
    container: 'w-6 h-6 rounded-md',
    img: 'w-5 h-5',
    text: 'text-[9px]'
  },
  sm: {
    container: 'w-8 h-8 rounded-lg',
    img: 'w-6 h-6',
    text: 'text-[10px]'
  },
  md: {
    container: 'w-11 h-11 sm:w-12 sm:h-12 rounded-xl',
    img: 'w-8 h-8 sm:w-9 sm:h-9',
    text: 'text-xs sm:text-sm'
  },
  lg: {
    container: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl',
    img: 'w-11 h-11 sm:w-13 sm:h-13',
    text: 'text-base font-bold'
  },
  xl: {
    container: 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl',
    img: 'w-16 h-16 sm:w-20 sm:h-20',
    text: 'text-lg font-black'
  },
  '2xl': {
    container: 'w-28 h-28 sm:w-32 sm:h-32 rounded-3xl',
    img: 'w-22 h-22 sm:w-26 sm:h-26',
    text: 'text-2xl font-black'
  }
};

export const ClubBadge: React.FC<ClubBadgeProps> = ({
  club,
  clubId,
  logoUrl,
  shortName,
  name,
  primaryColor,
  secondaryColor,
  size = 'md',
  className = '',
  showName = false
}) => {
  const effectiveId = club?.id || clubId;
  const dbClub = effectiveId ? INITIAL_CLUBS.find(c => c.id === effectiveId) : undefined;
  const effectiveShortName = club?.shortName || shortName || dbClub?.shortName || 'CLB';
  const effectiveName = club?.name || name || dbClub?.name || effectiveShortName;
  const effectivePrimary = club?.primaryColor || primaryColor || dbClub?.primaryColor || '#1e293b';
  const effectiveSecondary = club?.secondaryColor || secondaryColor || dbClub?.secondaryColor || '#ffffff';
  
  const sources = getClubLogoSources(
    effectiveId,
    club?.logoUrl || logoUrl || dbClub?.logoUrl,
    effectiveShortName
  );

  const [sourceIndex, setSourceIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  // Reset when club identity changes
  useEffect(() => {
    setSourceIndex(0);
    setAllFailed(false);
  }, [effectiveId, club?.logoUrl, logoUrl]);

  const currentSize = sizeClasses[size] || sizeClasses.md;
  const currentLogoUrl = sources[sourceIndex];

  const handleImageError = () => {
    if (sourceIndex + 1 < sources.length) {
      setSourceIndex(prev => prev + 1);
    } else {
      setAllFailed(true);
    }
  };

  const renderBadge = () => {
    // If we have an active logo source and it hasn't exhausted fallbacks
    if (currentLogoUrl && !allFailed) {
      return (
        <div
          className={`${currentSize.container} flex items-center justify-center p-1 bg-white/95 border border-white/20 shadow-md shrink-0 relative overflow-hidden transition-transform duration-200 ${className}`}
          style={{
            boxShadow: `0 4px 12px ${effectivePrimary}30`
          }}
          title={`${effectiveName} (Oficial & Licenciado)`}
        >
          <img
            key={currentLogoUrl}
            src={currentLogoUrl}
            alt={effectiveName}
            className={`${currentSize.img} object-contain filter drop-shadow-sm transition-transform duration-200 hover:scale-105`}
            loading="eager"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        </div>
      );
    }

    // High-contrast custom crest shield fallback with club colors
    return (
      <div
        className={`${currentSize.container} flex items-center justify-center font-heading font-black shrink-0 shadow-md border border-white/15 ${currentSize.text} ${className} relative overflow-hidden`}
        style={{
          backgroundColor: effectivePrimary,
          color: effectiveSecondary
        }}
        title={effectiveName}
      >
        {/* Subtle diagonal sash or stripe to look like an authentic crest */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, transparent 40%, ${effectiveSecondary} 40%, ${effectiveSecondary} 60%, transparent 60%)`
          }}
        />
        <span className="relative z-10 drop-shadow">{effectiveShortName.slice(0, 3)}</span>
      </div>
    );
  };

  if (showName) {
    return (
      <div className="flex items-center gap-3">
        {renderBadge()}
        <span className="font-bold text-neutral-100 text-sm tracking-tight truncate">
          {effectiveName}
        </span>
      </div>
    );
  }

  return renderBadge();
};


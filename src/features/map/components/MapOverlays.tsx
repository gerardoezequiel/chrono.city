interface MapOverlaysProps {
  isMobile?: boolean;
}

/**
 * Subtle cartographic overlays — vignette, crosshair, frame border.
 * All are CSS-only, pointer-events-none, purely decorative.
 * On mobile: reduced vignette, no crosshair (finger is the pointer).
 */
export function MapOverlays({ isMobile }: MapOverlaysProps): React.ReactElement {
  return (
    <>
      {/* Vignette — subtle edge darkening to focus attention on center */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: isMobile
            ? 'radial-gradient(ellipse at center, transparent 65%, rgba(0,0,0,0.04) 100%)'
            : 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.08) 100%)',
        }}
      />

      {/* Crosshair — hidden on mobile (finger is the pointer) */}
      {!isMobile && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <line x1="0" y1="10" x2="7" y2="10" stroke="#dc2626" strokeWidth="0.8" opacity="0.25" />
            <line x1="13" y1="10" x2="20" y2="10" stroke="#dc2626" strokeWidth="0.8" opacity="0.25" />
            <line x1="10" y1="0" x2="10" y2="7" stroke="#dc2626" strokeWidth="0.8" opacity="0.25" />
            <line x1="10" y1="13" x2="10" y2="20" stroke="#dc2626" strokeWidth="0.8" opacity="0.25" />
          </svg>
        </div>
      )}

      {/* Frame border — thin architectural border */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(220, 38, 38, 0.12)',
        }}
      />
    </>
  );
}

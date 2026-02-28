# Mobile Responsiveness Fix Plan

## Problem Summary

chrono.city is completely unusable on phones. The sidebar is hardcoded at 400px (most phones are 360-414px wide), covering the entire screen. The map is pushed off-screen with `left-[400px]`. There are zero responsive breakpoints in the entire codebase. Touch targets are below WCAG minimums, and text is illegible at mobile sizes.

---

## Critical Issues (Ranked by Impact)

### 1. LAYOUT KILLER: Sidebar covers entire phone screen
**Files:** `App.tsx:158,174` + `Sidebar.tsx:61`
- Sidebar: `fixed top-0 left-0 w-[400px] h-dvh z-50` — 400px fills/overflows a 360px phone
- Map container: `absolute top-0 left-[400px] right-0 bottom-0` — map starts at 400px, invisible on phone
- **Fix:** On mobile (<768px), switch to stacked layout: map fills viewport, sidebar becomes a bottom sheet that slides up/down. On tablet (768-1024px), use narrower sidebar (320px).

### 2. NO RESPONSIVE BREAKPOINTS
**Files:** Every component
- Zero `sm:`, `md:`, `lg:` Tailwind prefixes in the entire codebase
- **Fix:** Add mobile-first responsive classes to all layout-critical components

### 3. MAP CONTROLS TOO SMALL FOR TOUCH
**File:** `MapControls.tsx:12-14`
- Buttons are 32x32px (`w-[32px] h-[32px]`) — below WCAG 44x44px minimum
- **Fix:** On mobile, increase to `w-11 h-11` (44px). Also increase icon SVGs proportionally.

### 4. TEXT TOO SMALL FOR MOBILE
**Files:** Throughout sidebar components
- `text-[8px]`, `text-[9px]`, `text-[10px]` used extensively for labels, badges, coordinates
- Minimum readable on mobile is ~12px
- **Fix:** Scale up small text on mobile using responsive classes (e.g., `text-[10px] md:text-[8px]`)

### 5. HOVER-ONLY INTERACTIONS
**Files:** `Sidebar.tsx:71,101-103,118`, `MapControls.tsx:13-14`, `LocationBar.tsx:96,115,127`, `ScaleBar.tsx:140-141`
- Buttons rely on `hover:` state changes for visual feedback — invisible on touch devices
- **Fix:** Add `active:` states alongside `hover:` for touch feedback

### 6. ATTRIBUTION BUTTON TOO SMALL
**File:** `ScaleBar.tsx:139-141`
- 20x20px (`w-5 h-5`) — nearly impossible to tap on mobile
- **Fix:** Increase to 36px on mobile with larger tap area

### 7. RANGE SLIDER UNUSABLE ON TOUCH
**File:** `Sidebar.tsx:125-133`
- Slider thumb is 12x12px — too small for finger
- Track is 2px tall — nearly invisible to tap
- **Fix:** Increase thumb to 24x24px and track to 6px on mobile

### 8. SEARCH INPUT MOBILE KEYBOARD ISSUES
**File:** `LocationBar.tsx:83-91`
- Input triggers mobile keyboard which pushes content up
- Dropdown (`max-h-60`) may be clipped by keyboard
- **Fix:** Ensure dropdown has appropriate max-height accounting for keyboard

---

## Implementation Plan

### Phase A: Core Layout Restructure (highest impact)

#### A1. Create mobile layout hook
**New file:** `src/shared/hooks/useIsMobile.ts`
- `useIsMobile()` returns boolean (< 768px)
- Uses `matchMedia` for performance (no resize listener spam)
- SSR-safe with initial false

#### A2. Create MobileSheet wrapper
**New file:** `src/shared/components/MobileSheet.tsx`
- Bottom sheet with 3 snap points: collapsed (header only ~80px), half (~50vh), full (~85vh)
- Drag handle at top for swipe gestures
- Touch-based: onTouchStart/onTouchMove/onTouchEnd
- CSS transform for smooth animation (GPU-accelerated)
- Shows map behind it (map fills full viewport)
- No external library needed — ~100 lines of code

#### A3. Make App.tsx responsive
**File:** `src/app/App.tsx`

Mobile (<768px):
```
<div className="w-full h-full relative">
  <div className="absolute inset-0">  <!-- map fills entire screen -->
    <MapContainer /> + overlays
  </div>
  <MobileSheet>  <!-- bottom sheet overlay -->
    <Sidebar ... />
  </MobileSheet>
</div>
```

Desktop (>=768px):
```
Keep current 400px sidebar + left-[400px] map layout
```

#### A4. Make Sidebar responsive
**File:** `src/features/sections/components/Sidebar.tsx`

Mobile: Remove `fixed`, `w-[400px]`, `h-dvh` — parent MobileSheet handles positioning.
Use `w-full` and let content scroll within the sheet.

Desktop: Keep current `fixed top-0 left-0 w-[400px] h-dvh z-50`.

### Phase B: Touch Target & Interaction Fixes

#### B1. MapControls touch targets
**File:** `src/features/map/components/MapControls.tsx`
- Mobile: `w-11 h-11` (44px), icons scale to 20px
- Desktop: keep `w-[32px] h-[32px]`
- Add `active:` states for touch feedback
- Reposition on mobile: move to avoid overlap with bottom sheet

#### B2. Mode toggle, buttons, slider
**File:** `src/features/sections/components/Sidebar.tsx`
- Mode toggle buttons: add min-h-[44px] on mobile
- Clear button: increase padding on mobile
- Walk time slider: increase thumb to 24x24px and track height on mobile
- Add `active:` states everywhere `hover:` is used

#### B3. LocationBar touch improvements
**File:** `src/features/sections/components/LocationBar.tsx`
- Search input: increase height to 44px on mobile
- Search results: increase `py-2.5` → `py-3.5` on mobile for larger tap targets
- Close button: increase tap area

### Phase C: Typography Scale

All sidebar components — increase minimum text sizes on mobile:
```
Current → Mobile minimum:
text-[8px]  → text-[11px] md:text-[8px]
text-[9px]  → text-[11px] md:text-[9px]
text-[10px] → text-[12px] md:text-[10px]
text-[11px] → text-[13px] md:text-[11px]
```

Files: `SectionShell.tsx`, `MetricCard.tsx`, `ChronoScore.tsx`, `Sidebar.tsx`, `LocationBar.tsx`

### Phase D: Map Overlay Adjustments

#### D1. CoordinateGrid — hide on mobile
**File:** `src/features/map/components/CoordinateGrid.tsx`
- Too cluttered on small screens, adds no value on phone

#### D2. MapOverlays — reduce on mobile
**File:** `src/features/map/components/MapOverlays.tsx`
- Hide crosshair on mobile (finger is the pointer)
- Reduce vignette intensity

#### D3. ScaleBar — reposition on mobile
**File:** `src/features/map/components/ScaleBar.tsx`
- Move to avoid overlap with bottom sheet
- Attribution button: increase to `w-9 h-9` on mobile

### Phase E: CSS & Viewport

#### E1. Add viewport-fit for notch support
**File:** `index.html`
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

#### E2. Add safe area padding
**File:** `src/styles/index.css`
- Add `env(safe-area-inset-*)` for notched phones
- Add `touch-action: manipulation` on interactive elements to prevent double-tap zoom

---

## File Change Summary

| File | Change | Priority |
|------|--------|----------|
| `src/shared/hooks/useIsMobile.ts` | NEW | A |
| `src/shared/components/MobileSheet.tsx` | NEW | A |
| `src/app/App.tsx` | EDIT — conditional layout | A |
| `src/features/sections/components/Sidebar.tsx` | EDIT — responsive width/position | A |
| `src/features/map/components/MapControls.tsx` | EDIT — larger touch targets | B |
| `src/features/sections/components/LocationBar.tsx` | EDIT — touch improvements | B |
| `src/features/sections/components/SectionShell.tsx` | EDIT — responsive text | C |
| `src/shared/components/MetricCard.tsx` | EDIT — responsive text | C |
| `src/features/sections/components/ChronoScore.tsx` | EDIT — responsive text | C |
| `src/features/map/components/CoordinateGrid.tsx` | EDIT — hide on mobile | D |
| `src/features/map/components/MapOverlays.tsx` | EDIT — reduce on mobile | D |
| `src/features/map/components/ScaleBar.tsx` | EDIT — reposition + larger attr btn | D |
| `index.html` | EDIT — viewport-fit | E |
| `src/styles/index.css` | EDIT — safe areas, touch-action | E |

---

## Key Design Decisions

1. **Bottom sheet over hamburger menu** — The sidebar IS the app. Hiding it behind a hamburger kills the scroll-driven narrative. A bottom sheet keeps content visible and swipeable.

2. **No external library for bottom sheet** — Touch gesture handling is ~100 lines. Avoids adding a dependency and keeps bundle lean for mobile networks.

3. **CSS-first responsive approach** — Use Tailwind's responsive prefixes wherever possible. Only use the `useIsMobile` hook where layout structure must fundamentally change (bottom sheet vs sidebar).

4. **Mobile-first text scaling** — Write mobile sizes first, then `md:` for desktop reduction. This ensures mobile is never forgotten.

5. **Hide decorative elements on mobile** — CoordinateGrid, crosshair, and heavy vignette are desktop luxuries. Mobile needs clean, fast, uncluttered.

6. **Marker drag works on mobile** — MapLibre's built-in touch drag already works. The 28px marker is borderline but acceptable with the visual affordance (circle with icon). No changes needed here.

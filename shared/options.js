// Shared by the API (prompts + validation) and the UI (dropdowns).
export const TYPES = ['header', 'nav', 'hero', 'section', 'heading', 'text', 'image', 'button', 'link', 'card', 'form', 'input', 'footer', 'other']

// What each animation name means. The generator prompt quotes these so the
// model produces the same motion every time instead of improvising.
export const ENTER = {
  none: 'no scroll animation',
  fade: 'opacity 0 → 1',
  'slide-up': 'opacity 0 → 1 and y 40 → 0',
  'slide-left': 'opacity 0 → 1 and x -60 → 0 (comes in from the left)',
  'slide-right': 'opacity 0 → 1 and x 60 → 0 (comes in from the right)',
  zoom: 'opacity 0 → 1 and scale 0.85 → 1',
  blur: 'opacity 0 → 1 and filter blur(12px) → blur(0px)',
  'stagger-children': 'its direct children slide up one after another (variants with staggerChildren 0.1)',
}
export const HOVER = {
  none: 'no hover effect',
  lift: 'y -6 and a stronger box-shadow',
  grow: 'scale 1.05',
  glow: 'box-shadow glow in the accent colour',
  tilt: 'rotate -2deg and scale 1.02',
}
export const PAGE_TRANSITIONS = {
  fade: 'old page fades out, new page fades in',
  slide: 'new page slides in from the right while the old one exits to the left',
  zoom: 'old page scales down to 0.96 and fades, new page scales up from 1.04',
  blur: 'cross-fade through blur(10px)',
  flip: 'rotateY 90deg → 0 with perspective 1200px',
  none: 'switch instantly',
}

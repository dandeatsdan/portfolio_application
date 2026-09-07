/**
 * BP colour palette — single source of truth for the application.
 * Import `theme` anywhere you need a colour value.
 * CSS custom properties (identical values) live in index.css.
 */
export const bp = {
  // Greens
  deepGreen:    '#003600',
  darkGreen:    '#004F00',
  green:        '#007F00',
  lightGreen:   '#8EDF00',
  brightGreen:  '#CCFF00',
  paleGreen:    '#CBF200',

  // Whites / Greys (warm)
  white:        '#FFFFFF',
  warmGrey1:    '#F7F7F7',
  warmGrey2:    '#E1E3D6',
  warmGrey3:    '#BBBCAA',
  warmGrey4:    '#828474',
  warmGrey5:    '#494733',
  warmGrey6:    '#121000',

  // Yellow / Amber
  yellow:       '#FFE600',
  amber1:       '#C47400',
  amber2:       '#FF9A00',
  amber3:       '#FFD77C',

  // Oranges
  deepOrange1:  '#C80000',
  deepOrange2:  '#FF4116',
  deepOrange3:  '#FFB200',

  // Blues
  blue1:        '#0089A8',
  blue2:        '#14BFC8',
  blue3:        '#A3EDEA',
  deepBlue1:    '#004BAA',
  deepBlue2:    '#0070FF',
  deepBlue3:    '#AFECFF',

  // Purples
  purple1:      '#64009C',
  purple2:      '#983DC9',
  purple3:      '#E6C6FF',
}

export const theme = {
  // Canvas
  canvas:       bp.white,
  surface:      bp.warmGrey1,   // sidebar / panel backgrounds
  surface2:     bp.warmGrey2,   // hover / dividers

  // Header
  headerBg:     bp.deepGreen,
  headerText:   bp.white,

  // Navigation / sidebar
  navBg:        bp.deepGreen,
  navText:      bp.white,
  navActive:    bp.lightGreen,

  // Brand accents
  accent:       bp.lightGreen,
  accentDark:   bp.green,
  brightGreen:  bp.brightGreen,

  // Text
  text:         bp.warmGrey6,
  textMuted:    bp.warmGrey4,
  textLight:    bp.warmGrey3,

  // Borders
  border:       bp.warmGrey3,
  borderStrong: bp.green,

  // Semantic
  positive:     bp.lightGreen,
  negative:     bp.deepOrange2,
  warning:      bp.amber2,
  info:         bp.blue2,

  // Chart series (in preference order)
  chartPalette: [
    bp.blue2,
    bp.lightGreen,
    bp.blue1,
    bp.yellow,
    bp.deepBlue2,
    bp.purple2,
    bp.amber2,
    bp.brightGreen,
    bp.deepBlue1,
    bp.purple1,
    bp.deepOrange2,
    bp.amber1,
  ],
}

export default theme

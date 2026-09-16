/** @type {import('tailwindcss').Config} */

/* ============================================================
   Shopkeeper Portal — Tailwind configuration

   Every value here resolves to a CSS custom property defined in
   src/styles/tokens.css. Do not add raw hex values to this file.

   Tailwind v3. If the project is on v4, the same tokens can be
   declared in a single `@theme { }` block in CSS instead — the
   token names below carry over unchanged.
   ============================================================ */

const rgb = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    /* Replacing (not extending) colors removes Tailwind's default
       palette. This is deliberate: it makes `bg-blue-500` an error
       rather than a silent inconsistency. */
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',

      accent: {
        DEFAULT: rgb('--color-accent'),
        hover:   rgb('--color-accent-hover'),
        active:  rgb('--color-accent-active'),
        subtle:  rgb('--color-accent-subtle'),
        border:  rgb('--color-accent-border'),
        fg:      rgb('--color-on-accent'),
      },

      text: {
        DEFAULT:   rgb('--color-text-primary'),
        secondary: rgb('--color-text-secondary'),
        muted:     rgb('--color-text-muted'),
        disabled:  rgb('--color-text-disabled'),
        inverse:   rgb('--color-text-inverse'),
      },

      canvas:  rgb('--color-canvas'),
      surface: {
        DEFAULT: rgb('--color-surface'),
        raised:  rgb('--color-surface-raised'),
        sunken:  rgb('--color-surface-sunken'),
        hover:   rgb('--color-surface-hover'),
      },

      border: {
        DEFAULT: rgb('--color-border'),
        strong:  rgb('--color-border-strong'),
        focus:   rgb('--color-border-focus'),
      },

      sidebar: {
        DEFAULT:    rgb('--color-sidebar'),
        hover:      rgb('--color-sidebar-hover'),
        active:     rgb('--color-sidebar-active'),
        text:       rgb('--color-sidebar-text'),
        'text-active': rgb('--color-sidebar-text-active'),
        border:     rgb('--color-sidebar-border'),
      },

      success: { DEFAULT: rgb('--color-success'), bg: rgb('--color-success-bg'), fg: rgb('--color-success-fg'), border: rgb('--color-success-border') },
      warning: { DEFAULT: rgb('--color-warning'), bg: rgb('--color-warning-bg'), fg: rgb('--color-warning-fg'), border: rgb('--color-warning-border') },
      danger:  { DEFAULT: rgb('--color-danger'),  hover: rgb('--color-danger-hover'), bg: rgb('--color-danger-bg'), fg: rgb('--color-danger-fg'), border: rgb('--color-danger-border') },
      info:    { DEFAULT: rgb('--color-info'),    bg: rgb('--color-info-bg'),    fg: rgb('--color-info-fg'),    border: rgb('--color-info-border') },
      violet:  { DEFAULT: rgb('--color-violet'),  bg: rgb('--color-violet-bg'),  fg: rgb('--color-violet-fg'),  border: rgb('--color-violet-border') },
      neutral: { bg: rgb('--color-neutral-bg'),   fg: rgb('--color-neutral-fg'),  border: rgb('--color-neutral-border') },
    },

    /* Brief section 3: H1 32, H2 24, H3 20, Body 16, Small 14, Caption 12.
       Line-heights and default weights added — the brief omits them,
       and unspecified line-height is the most common cause of a
       "close but somehow off" dashboard. */
    fontSize: {
      caption: ['0.75rem',  { lineHeight: '1rem',     fontWeight: '500', letterSpacing: '0.01em' }], // 12
      small:   ['0.875rem', { lineHeight: '1.25rem',  fontWeight: '400' }],                          // 14
      body:    ['1rem',     { lineHeight: '1.5rem',   fontWeight: '400' }],                          // 16
      h3:      ['1.25rem',  { lineHeight: '1.75rem',  fontWeight: '600', letterSpacing: '-0.01em' }], // 20
      h2:      ['1.5rem',   { lineHeight: '2rem',     fontWeight: '600', letterSpacing: '-0.015em' }],// 24
      h1:      ['2rem',     { lineHeight: '2.5rem',   fontWeight: '700', letterSpacing: '-0.02em' }], // 32
      /* Metric numerals on dashboard stat cards. */
      metric:  ['2.25rem',  { lineHeight: '2.5rem',   fontWeight: '700', letterSpacing: '-0.025em' }],// 36
    },

    /* Brief section 3: 4, 8, 12, 16, 24, 32.
       Extended upward for page-level section rhythm. */
    spacing: {
      0: '0',
      1: '0.25rem',  //  4
      2: '0.5rem',   //  8
      3: '0.75rem',  // 12
      4: '1rem',     // 16
      6: '1.5rem',   // 24
      8: '2rem',     // 32
      12: '3rem',    // 48
      16: '4rem',    // 64
      /* Fixed shell dimensions */
      sidebar: '15rem',          // 240
      'sidebar-collapsed': '4rem', // 64
      topbar: '4rem',            // 64
    },

    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        /* Tabular numerals for currency columns and metrics so
           amounts align vertically in tables. */
        numeric: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontFeatureSettings: {
        numeric: '"tnum" 1, "cv11" 1',
      },
      borderRadius: {
        sm:   '0.25rem',  //  4  badges, chips
        md:   '0.375rem', //  6  inputs, small buttons
        lg:   '0.5rem',   //  8  buttons, dropdowns
        xl:   '0.75rem',  // 12  cards, panels
        '2xl':'1rem',     // 16  modals
        full: '9999px',   //     pills, avatars
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        none: 'none',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        in:  'var(--ease-in)',
      },
      ringWidth:       { DEFAULT: '2px' },
      ringOffsetWidth: { DEFAULT: '2px' },
      ringColor:       { DEFAULT: rgb('--color-border-focus') },

      maxWidth: {
        content: '90rem', // 1440 — dashboard content cap
        prose:   '68ch',  //        long-form text
        form:    '28rem', // 448  — login / single-column forms
      },

      /* Documented layer scale. Never write an ad-hoc z-index. */
      zIndex: {
        base: '0',
        dropdown: '10',
        sticky: '20',
        overlay: '30',
        modal: '40',
        popover: '50',
        toast: '60',
      },

      screens: {
        sm: '375px',
        md: '768px',
        lg: '1280px',
        xl: '1536px',
      },

      keyframes: {
        'fade-in':   { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up':  { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer:     { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in':  'fade-in var(--duration-base) var(--ease-out)',
        'slide-up': 'slide-up var(--duration-base) var(--ease-out)',
        shimmer:    'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({ strategy: 'class' }),
  ],
};

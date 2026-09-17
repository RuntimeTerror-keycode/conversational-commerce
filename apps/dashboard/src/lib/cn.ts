import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge has to be told about our theme's custom keys.
 *
 * Out of the box it cannot tell `text-body` (a font size in
 * styles/tokens.css) from `text-on-accent` (a colour). It filed both under
 * the same group, so `cn('text-on-accent', 'text-body')` silently dropped the
 * colour — which is exactly how the primary button ended up with ink-coloured
 * text on a teal fill.
 *
 * Listing the font-size keys explicitly leaves every other `text-*` to be
 * treated as a colour, which is what they are.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['metric', 'h1', 'h2', 'h3', 'body', 'small', 'caption'] },
      ],
      shadow: [{ shadow: ['xs', 'sm', 'md', 'lg'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

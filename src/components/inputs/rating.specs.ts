/**
 * Rating — star (or custom icon) scale, Sober `s-rate`–inspired.
 *
 * `max` = number of icons (default 5). Value spans `min`…`max` with `step`
 * (1 or 0.5 typical). Colors: theme role + optional `active-color` /
 * `inactive-color` / CSS vars.
 */

export type RatingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type RatingColor = 'primary' | 'secondary' | 'tertiary' | 'error';

/** Icon optical size (dp) per size ladder. */
export const RatingIconDp: Record<RatingSize, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
};

/** Hit target min (dp) — keep ≥ 48 on md+ for touch. */
export const RatingTargetDp: Record<RatingSize, number> = {
  xs: 32,
  sm: 40,
  md: 48,
  lg: 48,
  xl: 56,
};

export const RatingSpecs = {
  defaultSize: 'md' as RatingSize,
  defaultColor: 'primary' as RatingColor,
  defaultMax: 5,
  defaultMin: 0,
  defaultValue: 0,
  defaultStep: 1,
  defaultIcon: 'star',
  iconDp: RatingIconDp,
  targetDp: RatingTargetDp,
  accessibility: {
    role: 'slider',
  },
} as const;

export function resolveRatingSize(size: string | null | undefined): RatingSize {
  if (size === 'xs' || size === 'sm' || size === 'md' || size === 'lg' || size === 'xl') {
    return size;
  }
  return RatingSpecs.defaultSize;
}

export function resolveRatingColor(color: string | null | undefined): RatingColor {
  if (
    color === 'primary' ||
    color === 'secondary' ||
    color === 'tertiary' ||
    color === 'error'
  ) {
    return color;
  }
  return RatingSpecs.defaultColor;
}

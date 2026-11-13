/**
 * The slice of Material Color Utilities the audio player loads on demand
 * (artwork seed + scoped scheme). Importing named bindings — not the whole
 * package namespace — lets the bundler drop quantizers / schemes / helpers the
 * player never calls, even when dynamic imports are inlined into k3ui.js.
 */
export {
  argbFromHex,
  hexFromArgb,
  sourceColorFromImage,
  Hct,
  MaterialDynamicColors,
  SchemeExpressive,
  SchemeFidelity,
  SchemeTonalSpot,
  SchemeVibrant,
} from '@material/material-color-utilities';

/**
 * Authentic qr.io outer-frame silhouettes.
 *
 * Paths / viewBoxes taken from qr.io generator thumbnails (and the bag export
 * SVG, which qr.io ships with `scale(35)×scale(0.086)`). Mapped so the QR
 * window equals `span` module units.
 */

export interface QrIoSilhouette {
  /** Artboard size (viewBox width × height). */
  readonly vbW: number;
  readonly vbH: number;
  /** QR window in artboard coords. */
  readonly qrX: number;
  readonly qrY: number;
  readonly qrSize: number;
  /** Optional translate applied to `path` (phone thumbnail). */
  readonly pathTx?: number;
  readonly pathTy?: number;
  /** Native path `d` (qr.io Shape). */
  readonly path: string;
  /** Text alphabetic baseline Y (centred on vbW/2). */
  readonly textY: number;
  /** Native font-size in artboard units. */
  readonly textFs: number;
  /**
   * When true, phrase is painted with the frame colour (qr.io circle uses black
   * text under a stroked ring). Default: contrast colour on the filled frame.
   */
  readonly textUsesFrameColor?: boolean;
}

/** Circular ring frame — qr.io export (`new-frame-9`). */
export interface QrIoCircleFrame {
  readonly kind: 'circle';
  readonly vbW: number;
  readonly vbH: number;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly stroke: number;
  readonly textY: number;
  readonly textFs: number;
}

/** qr.io circle export: `scale(39.774583333333)×scale(0.04515)`. */
export const CIRCLE_PATH_SCALE = 39.774583333333 * 0.04515;

/**
 * Shopping bag — exact export path from qr.io SVG
 * (`viewBox="0 0 840 1170.75"`, path under `scale(35) scale(0.086)`).
 */
export const QR_IO_BAG: QrIoSilhouette = {
  vbW: 840,
  vbH: 1170.75,
  qrX: 30,
  qrY: 183,
  qrSize: 777.7,
  /* Bake scale(35)×scale(0.086) = 3.01 into the path via pathScale in the helper. */
  pathTx: 0,
  pathTy: 0,
  path: 'M265.4,42.1h-66.1v-8.7c0-6.4-5.1-11.5-11.5-11.5h-26.4c0-12.1-9.8-21.9-21.9-21.9s-21.9,9.8-21.9,21.9H91.2c-6.4,0-11.5,5.1-11.5,11.5v8.7H13.8C6.2,42.1,0.1,48.3,0,55.8V375c0,7.6,6.2,13.7,13.7,13.7h251.7c7.6,0,13.7-6.2,13.7-13.7V55.8C279.1,48.2,272.9,42.1,265.4,42.1z M139.6,11.9c5.6,0,10.1,4.5,10.1,10.1c0,5.6-4.5,10.1-10.1,10.1c-5.6,0-10.1-4.5-10.1-10.1S134,11.9,139.6,11.9z M267.6,301.1c0,7,-7,7,-7,7H19c-4.1,0-7.4-3.3-7.4-7.4V60c0-4.1,3.3-7.4,5.4-7.4h243.2c4.1,0,7.4,3.3,7.4,7.4V303.3z',
  /** Export applies scale 3.01 to the path — see BAG_PATH_SCALE. */
  textY: 1094.25,
  textFs: 130,
};

/** Path units → artboard units for {@link QR_IO_BAG}. */
export const BAG_PATH_SCALE = 35 * 0.086;

/** Clipboard / tote — qr.io `new-frame-8`. */
export const QR_IO_CLIPBOARD: QrIoSilhouette = {
  vbW: 1000,
  vbH: 1470,
  qrX: 84.5963688,
  qrY: 318.583333,
  qrSize: 854.291667,
  path: 'M985.456235,313.7568 C984.806635,285.1744 961.096235,262.1136 932.513835,262.1136 L744.129835,262.1136 L744.129835,117.2528 C744.129835,104.9104 739.257835,92.8928 730.488235,84.448 L677.870635,31.1808 C657.733035,11.368 630.449835,0 602.192235,0 L413.158635,0 C384.901035,0 357.617835,11.368 337.480235,31.1808 L284.537835,84.1232 C275.768235,92.8928 270.896235,104.5856 270.896235,116.928 L270.896235,262.1136 L82.5122354,262.1136 C53.9298354,262.1136 30.2194354,284.8496 29.5698354,313.7568 L0.0130354394,1403.136 C-0.636564561,1433.0176 23.0738354,1457.7024 52.9554354,1457.7024 L962.070635,1457.7024 C991.952235,1457.7024 1015.98744,1433.0176 1015.01304,1403.136 L985.456235,313.7568 Z M368.661035,97.7648 L646.365035,97.7648 L646.365035,262.1136 L368.661035,262.1136 L368.661035,97.7648 Z M926.667435,1128.0304 C926.667435,1141.3472 915.949035,1152.0656 902.632235,1152.0656 L112.718635,1152.0656 C99.4018354,1152.0656 88.6834354,1141.3472 88.6834354,1128.0304 L88.6834354,337.792 C88.6834354,324.4752 99.4018354,313.7568 112.718635,313.7568 L902.632235,313.7568 C915.949035,313.7568 926.667435,324.4752 926.667435,337.792 L926.667435,1128.0304 L926.667435,1128.0304 Z',
  textY: 1347.67989,
  textFs: 120,
};

/** Smartphone — qr.io `phone` (path lives in a `translate(34,0)` group). */
export const QR_IO_PHONE: QrIoSilhouette = {
  vbW: 850,
  vbH: 1250,
  qrX: 55,
  qrY: 261,
  qrSize: 736,
  pathTx: 34,
  pathTy: 0,
  path: 'M677.025449,0 L93.7419853,0 C41.6631046,0 0,41.6666667 0,93.75 L0,1156.25 C0,1208.33333 41.6631046,1250 93.7419853,1250 L671.817561,1250 C723.896442,1250 765.559547,1208.33333 765.559547,1156.25 L765.559547,93.75 C770.767435,41.6666667 729.10433,0 677.025449,0 Z M343.720613,119.791667 L484.333591,119.791667 C489.541479,119.791667 494.749367,125 494.749367,130.208333 C494.749367,135.416667 489.541479,140.625 484.333591,140.625 L343.720613,140.625 C338.512725,140.625 333.304837,135.416667 333.304837,130.208333 C333.304837,125 338.512725,119.791667 343.720613,119.791667 Z M286.433844,119.791667 C291.641732,119.791667 296.84962,125 296.84962,130.208333 C296.84962,135.416667 291.641732,140.625 286.433844,140.625 C281.225956,140.625 276.018068,135.416667 276.018068,130.208333 C276.018068,125 281.225956,119.791667 286.433844,119.791667 Z M749.935882,989.583333 L20.8315523,989.583333 L20.8315523,260.416667 L749.935882,260.416667 L749.935882,989.583333 Z',
  textY: 1154,
  textFs: 120,
};

/** Bottom banner box — qr.io `bottom`. */
export const QR_IO_BANNER: QrIoSilhouette = {
  vbW: 1000,
  vbH: 1250,
  qrX: 41.6666667,
  qrY: 41.6666667,
  qrSize: 925.833333,
  path: 'M945.833333,0 L54.1666667,0 C25,0 0,25 0,54.1666667 L0,1108.33333 C0,1141.66667 25,1166.66667 54.1666667,1166.66667 L941.666667,1166.66667 C970.833333,1166.66667 995.833333,1141.66667 995.833333,1112.5 L995.833333,54.1666667 C1000,25 975,0 945.833333,0 Z M958.333333,916.666667 C958.333333,941.666667 937.5,958.333333 916.666667,958.333333 L83.3333333,958.333333 C58.3333333,958.333333 41.6666667,937.5 41.6666667,916.666667 L41.6666667,83.3333333 C41.6666667,58.3333333 62.5,41.6666667 83.3333333,41.6666667 L916.666667,41.6666667 C941.666667,41.6666667 958.333333,62.5 958.333333,83.3333333 L958.333333,916.666667 Z',
  textY: 1108.65385,
  textFs: 120,
};

/**
 * Circular stroke frame — exact qr.io export metrics
 * (`viewBox="0 0 954.59 1151.46"`, circle cx/cy=266 r=260.5 stroke=10
 * under `scale(39.77)×scale(0.04515)`).
 */
export const QR_IO_CIRCLE: QrIoCircleFrame = {
  kind: 'circle',
  vbW: 954.59,
  vbH: 1151.4629166667,
  cx: 266 * CIRCLE_PATH_SCALE,
  cy: 266 * CIRCLE_PATH_SCALE,
  r: 260.5 * CIRCLE_PATH_SCALE,
  stroke: 10 * CIRCLE_PATH_SCALE,
  textY: 145.43645833333 + 954.59,
  textFs: 130,
};

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeQr,
  QrCapacityError,
  qrAlignmentPositions,
  qrByteCapacity,
  qrDetectMode,
} from '../../src/components/media/qr-code.encoder.js';
import {
  buildQrPayload,
  emptyQrPayloads,
  escapeWifi,
  normalizePhone,
  normalizeUrl,
  toICalDate,
  validateQrPayload,
} from '../../src/components/media/qr-code.payload.js';
import {
  QR_DOT_STYLES,
  QR_EYE_BALL_STYLES,
  QR_EYE_FRAME_STYLES,
  QR_FRAME_STYLES,
  contrastRatio,
  qrLogoBox,
  renderQr,
  renderQrSvg,
  safeColor,
  safeHref,
} from '../../src/components/media/qr-code.render.js';
import {
  QR_IO_MARKER_IN,
  QR_IO_MARKERS,
  QR_IO_PATTERNS,
} from '../../src/components/media/qr-code.qrio-shapes.js';
import { clampExportSize, qrFilename } from '../../src/components/media/qr-code.specs.js';
import '../../src/components/media/qr-code.js';
import type { K3QrCode, QrDownloadDetail } from '../../src/components/media/qr-code.js';
import { QR_GOLDEN } from './qr-code.golden.js';

const rowsOf = (m: { size: number; modules: Uint8Array }): string[] =>
  Array.from({ length: m.size }, (_, y) =>
    Array.from({ length: m.size }, (_, x) => (m.modules[y * m.size + x] ? '1' : '0')).join(''),
  );

describe('qr-code encoder', () => {
  it.each(QR_GOLDEN)('matches the reference matrix for "$text" ($ecc, mask $mask)', (g) => {
    const m = encodeQr(g.text, { ecc: g.ecc, mask: g.mask, mode: g.mode });
    expect(m.version).toBe(g.version);
    expect(m.mode).toBe(g.mode);
    expect(rowsOf(m)).toEqual(g.rows);
  });

  it('picks the most compact mode', () => {
    expect(qrDetectMode('0123456789')).toBe('numeric');
    expect(qrDetectMode('HELLO WORLD $%*+-./:')).toBe('alphanumeric');
    expect(qrDetectMode('hello')).toBe('byte');
    expect(qrDetectMode('é')).toBe('byte');
  });

  it('matches the spec byte capacities', () => {
    expect(qrByteCapacity(1, 'L')).toBe(17);
    expect(qrByteCapacity(1, 'M')).toBe(14);
    expect(qrByteCapacity(1, 'Q')).toBe(11);
    expect(qrByteCapacity(1, 'H')).toBe(7);
    expect(qrByteCapacity(40, 'L')).toBe(2953);
    expect(qrByteCapacity(40, 'H')).toBe(1273);
  });

  it('places alignment patterns per spec', () => {
    expect(qrAlignmentPositions(1)).toEqual([]);
    expect(qrAlignmentPositions(2)).toEqual([6, 18]);
    expect(qrAlignmentPositions(7)).toEqual([6, 22, 38]);
    expect(qrAlignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
  });

  it('encodes UTF-8 (accents, emoji) in byte mode', () => {
    const m = encodeQr('Ça marche 😀', { ecc: 'M' });
    expect(m.mode).toBe('byte');
    expect(m.length).toBe(new TextEncoder().encode('Ça marche 😀').length);
    expect(m.size).toBe(m.version * 4 + 17);
  });

  it('honours minVersion and boostEcc', () => {
    expect(encodeQr('A', { minVersion: 5 }).version).toBe(5);
    expect(encodeQr('A', { ecc: 'L', boostEcc: true }).ecc).toBe('H');
  });

  it('throws QrCapacityError when the payload is too long', () => {
    expect(() => encodeQr('x'.repeat(3000), { ecc: 'L' })).toThrow(QrCapacityError);
    expect(() => encodeQr('x'.repeat(200), { ecc: 'H', maxVersion: 5 })).toThrow(QrCapacityError);
  });

  it('flags function modules (finders, timing, format)', () => {
    const m = encodeQr('K3', { ecc: 'L' });
    const fn = (x: number, y: number) => m.functions[y * m.size + x] === 1;
    expect(fn(0, 0)).toBe(true); // finder
    expect(fn(6, 10)).toBe(true); // timing column
    expect(fn(8, m.size - 8)).toBe(true); // dark module
    expect(fn(m.size - 1, m.size - 1)).toBe(false); // data area
  });
});

describe('qr-code payloads', () => {
  it('normalises URLs and phone numbers', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('http://a.io')).toBe('http://a.io');
    expect(normalizePhone('0033 6 12-34.56 78')).toBe('+33612345678');
  });

  it('builds a link, call and SMS', () => {
    expect(buildQrPayload('link', { url: 'k3ui.dev' })).toBe('https://k3ui.dev');
    expect(buildQrPayload('phone', { phone: '+33 6 12 34 56 78' })).toBe('tel:+33612345678');
    expect(buildQrPayload('sms', { phone: '+33612345678', message: 'Salut' })).toBe('SMSTO:+33612345678:Salut');
  });

  it('builds mailto with encoded subject and body', () => {
    expect(buildQrPayload('email', { to: 'a@b.fr', subject: 'Bonjour à toi', body: 'L1\nL2' })).toBe(
      'mailto:a@b.fr?subject=Bonjour%20%C3%A0%20toi&body=L1%0AL2',
    );
  });

  it('builds WhatsApp links with digits only', () => {
    expect(buildQrPayload('whatsapp', { phone: '+33 6 12 34 56 78', message: 'Hi & bye' })).toBe(
      'https://wa.me/33612345678?text=Hi%20%26%20bye',
    );
  });

  it('escapes Wi-Fi fields', () => {
    expect(escapeWifi('a;b,c:d"e\\f')).toBe('a\\;b\\,c\\:d\\"e\\\\f');
    expect(
      buildQrPayload('wifi', { ssid: 'My;Net', password: 'p:ss', encryption: 'WPA', hidden: true }),
    ).toBe('WIFI:T:WPA;S:My\\;Net;P:p\\:ss;H:true;;');
    expect(buildQrPayload('wifi', { ssid: 'Café', password: '', encryption: 'nopass', hidden: false })).toBe(
      'WIFI:T:nopass;S:Café;;',
    );
  });

  it('builds a vCard 3.0 with CRLF and escaping', () => {
    const v = buildQrPayload('vcard', {
      ...emptyQrPayloads().vcard,
      firstName: 'Jean',
      lastName: 'Dupont',
      company: 'K3, SAS',
      phone: '+33 1 23 45 67 89',
      email: 'jean@k3ui.dev',
      city: 'Paris',
    });
    expect(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\nN:Dupont;Jean;;;\r\nFN:Jean Dupont')).toBe(true);
    expect(v).toContain('ORG:K3\\, SAS');
    expect(v).toContain('TEL;TYPE=WORK,VOICE:+33123456789');
    expect(v).toContain('ADR;TYPE=WORK:;;;Paris;;;');
    expect(v.endsWith('END:VCARD')).toBe(true);
  });

  it('builds events (timed and all-day)', () => {
    const timed = buildQrPayload('event', {
      ...emptyQrPayloads().event,
      title: 'Lancement',
      start: '2026-11-03T19:00',
      end: '2026-11-03T21:30',
      location: 'Paris; salle 2',
    });
    expect(timed).toContain('DTSTART:20261103T190000');
    expect(timed).toContain('DTEND:20261103T213000');
    expect(timed).toContain('LOCATION:Paris\\; salle 2');

    const allDay = buildQrPayload('event', {
      ...emptyQrPayloads().event,
      title: 'Salon',
      start: '2026-12-31',
      allDay: true,
    });
    expect(allDay).toContain('DTSTART;VALUE=DATE:20261231');
    expect(allDay).toContain('DTEND;VALUE=DATE:20270101');
    expect(toICalDate('nope', false)).toBe('');
  });

  it('validates required and malformed fields', () => {
    expect(validateQrPayload('link', { url: '' })).toEqual({ url: 'required' });
    expect(validateQrPayload('link', { url: 'not a url' })).toEqual({ url: 'url' });
    expect(validateQrPayload('email', { to: 'nope', subject: '', body: '' })).toEqual({ to: 'email' });
    expect(
      validateQrPayload('event', {
        ...emptyQrPayloads().event,
        title: 'X',
        start: '2026-11-03T19:00',
        end: '2026-11-03T18:00',
      }),
    ).toEqual({ end: 'endBeforeStart' });
    expect(buildQrPayload('wifi', { ssid: 'Home', password: '', encryption: 'WPA', hidden: false })).toBe('');
  });
});

describe('qr-code renderer', () => {
  const m = encodeQr('https://github.com/Kam3leoN/k3ui-expressive', { ecc: 'H' });

  it('exposes the full qr.io pattern / marker / marker_in catalogues', () => {
    expect(QR_DOT_STYLES).toEqual([...QR_IO_PATTERNS]);
    expect(QR_EYE_FRAME_STYLES).toEqual([...QR_IO_MARKERS]);
    expect(QR_EYE_BALL_STYLES).toEqual([...QR_IO_MARKER_IN]);
    expect(QR_DOT_STYLES).toHaveLength(19);
    expect(QR_EYE_FRAME_STYLES).toHaveLength(12);
    expect(QR_EYE_BALL_STYLES).toHaveLength(16);
  });

  it('renders every dot style and frame as standalone SVG', () => {
    for (const dotStyle of QR_DOT_STYLES) {
      for (const frame of QR_FRAME_STYLES) {
        const svg = renderQrSvg(m, { dotStyle, frame, frameText: 'Scan' });
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
        expect(svg).toContain('role="img"');
      }
    }
  });

  it('renders every marker × marker_in combination', () => {
    for (const eyeFrameStyle of QR_EYE_FRAME_STYLES) {
      for (const eyeBallStyle of QR_EYE_BALL_STYLES) {
        const svg = renderQrSvg(m, { eyeFrameStyle, eyeBallStyle });
        expect(svg).toContain('fill-rule="evenodd"');
        expect(svg).toContain('transform="translate(');
      }
    }
  });

  it('accepts legacy style aliases', () => {
    const svg = renderQrSvg(m, { dotStyle: 'dots', eyeFrameStyle: 'square', eyeBallStyle: 'leaf' });
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('frames change the aspect ratio and pixel size', () => {
    const none = renderQr(m, { frame: 'none' });
    const box = renderQr(m, { frame: 'box' }, 1000);
    expect(none.width).toBe(none.height);
    expect(box.height).toBeGreaterThan(box.width);
    expect(box.svg).toMatch(/width="1000" height="\d+"/);
  });

  it('adds gradient definitions in user space', () => {
    const svg = renderQrSvg(m, { gradient: 'linear', color: '#6750a4', gradientColor: '#00639b' });
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
    expect(renderQrSvg(m, { gradient: 'radial' })).toContain('<radialGradient');
  });

  it('escapes text and rejects unsafe colours and URLs', () => {
    const svg = renderQrSvg(m, {
      frame: 'box',
      frameText: '<script>alert(1)</script>',
      color: 'red;fill:url(javascript:x)',
      logo: 'javascript:alert(1)',
      title: '"><img>',
    });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toContain('javascript:');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('"><img>');
    expect(safeColor('#ABCDEF', '#000')).toBe('#ABCDEF');
    expect(safeColor('url(#x)', '#000')).toBe('#000');
    expect(safeHref('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(safeHref('data:text/html,<b>')).toBe('');
  });

  it('keeps the logo within the error-correction budget and away from finders', () => {
    for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
      for (const text of ['k3', 'https://k3ui.dev/' + 'x'.repeat(80)]) {
        const mm = encodeQr(text, { ecc });
        const box = qrLogoBox(mm, 0.45, 1);
        const budget = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 }[ecc] * 0.5 * mm.size * mm.size;
        expect(box.hideSize ** 2).toBeLessThanOrEqual(budget + 1e-9);
        expect(box.hideStart).toBeGreaterThanOrEqual(8);
        expect(box.size).toBeLessThanOrEqual(box.hideSize);
      }
    }
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#888888')!).toBeLessThan(1.5);
  });

  it('builds safe export filenames', () => {
    expect(qrFilename('menu', 'png')).toBe('menu.png');
    expect(qrFilename('menu.png', 'jpeg')).toBe('menu.jpg');
    expect(qrFilename('a/b:c', 'svg')).toBe('a-b-c.svg');
    expect(clampExportSize(99999)).toBe(4096);
  });
});

describe('k3-qr-code', () => {
  let el: K3QrCode;

  beforeEach(async () => {
    el = document.createElement('k3-qr-code');
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => el.remove());

  it('shows the empty state until a value is set', () => {
    expect(customElements.get('k3-qr-code')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('[part="state"]')).toBeTruthy();
    expect(el.info).toBeNull();
  });

  it('renders an SVG and announces k3-render', async () => {
    const onRender = vi.fn();
    el.addEventListener('k3-render', onRender);
    el.value = 'https://k3ui.dev';
    el.ecc = 'Q';
    await el.updateComplete;
    const svg = el.shadowRoot!.querySelector('[part="code"] svg');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('aria-label')).toBe('QR code');
    expect(onRender).toHaveBeenCalledTimes(1);
    const detail = onRender.mock.calls[0]![0].detail;
    expect(detail.ecc).toBe('Q');
    expect(detail.modules).toBe(detail.version * 4 + 17);
  });

  it('reflects styling attributes', async () => {
    el.setAttribute('dot-style', 'dots');
    el.setAttribute('frame', 'bubble');
    el.value = 'K3';
    await el.updateComplete;
    expect(el.dotStyle).toBe('dots');
    expect(el.getAttribute('frame')).toBe('bubble');
    expect(el.shadowRoot!.innerHTML).toContain('Scan me');
  });

  it('switches to the error state on overflow', async () => {
    const onError = vi.fn();
    el.addEventListener('k3-error', onError);
    el.ecc = 'H';
    el.value = 'x'.repeat(2000);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.state--error')).toBeTruthy();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('exports sized SVG markup', async () => {
    el.value = 'K3';
    await el.updateComplete;
    const svg = el.toSvg(512);
    expect(svg).toContain('width="512"');
  });

  it('fires a cancelable k3-download before saving', async () => {
    el.value = 'K3';
    el.filename = 'menu';
    await el.updateComplete;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    let detail: QrDownloadDetail | undefined;
    el.addEventListener('k3-download', (e) => {
      detail = (e as CustomEvent<QrDownloadDetail>).detail;
      e.preventDefault();
    });
    const ok = await el.download('svg', { size: 300 });
    expect(ok).toBe(true);
    expect(detail?.filename).toBe('menu.svg');
    expect(detail?.blob.type).toBe('image/svg+xml');
    expect(detail?.width).toBe(300);
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });
});

/**
 * QR payload builders — the static content types offered by qr.io:
 * link · text · e-mail · call · SMS · WhatsApp · Wi-Fi · vCard · event.
 *
 * Formats follow what native camera apps (iOS / Android) and ZXing parse:
 * `mailto:` · `tel:` · `SMSTO:` · `https://wa.me/` · `WIFI:` · vCard 3.0 ·
 * iCalendar `VEVENT`. Pure functions — no DOM.
 */

export type QrContentType =
  | 'link'
  | 'text'
  | 'email'
  | 'phone'
  | 'sms'
  | 'whatsapp'
  | 'wifi'
  | 'vcard'
  | 'event';

export const QR_CONTENT_TYPES: readonly QrContentType[] = [
  'link',
  'text',
  'email',
  'phone',
  'sms',
  'whatsapp',
  'wifi',
  'vcard',
  'event',
];

export type QrWifiEncryption = 'WPA' | 'WEP' | 'nopass';

export interface QrLinkData {
  url: string;
}
export interface QrTextData {
  text: string;
}
export interface QrEmailData {
  to: string;
  subject: string;
  body: string;
}
export interface QrPhoneData {
  phone: string;
}
export interface QrSmsData {
  phone: string;
  message: string;
}
export interface QrWhatsAppData {
  phone: string;
  message: string;
}
export interface QrWifiData {
  ssid: string;
  password: string;
  encryption: QrWifiEncryption;
  hidden: boolean;
}
export interface QrVCardData {
  firstName: string;
  lastName: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  company: string;
  jobTitle: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}
export interface QrEventData {
  title: string;
  location: string;
  /** `YYYY-MM-DDTHH:mm` (or `YYYY-MM-DD` when `allDay`). */
  start: string;
  end: string;
  allDay: boolean;
  description: string;
}

export interface QrPayloadMap {
  link: QrLinkData;
  text: QrTextData;
  email: QrEmailData;
  phone: QrPhoneData;
  sms: QrSmsData;
  whatsapp: QrWhatsAppData;
  wifi: QrWifiData;
  vcard: QrVCardData;
  event: QrEventData;
}

/** Field-level validation codes (mapped to i18n by the generator). */
export type QrFieldError = 'required' | 'url' | 'email' | 'phone' | 'date' | 'endBeforeStart' | 'name';

export type QrFieldErrors = Partial<Record<string, QrFieldError>>;

/** Empty data set for every content type. */
export function emptyQrPayloads(): QrPayloadMap {
  return {
    link: { url: '' },
    text: { text: '' },
    email: { to: '', subject: '', body: '' },
    phone: { phone: '' },
    sms: { phone: '', message: '' },
    whatsapp: { phone: '', message: '' },
    wifi: { ssid: '', password: '', encryption: 'WPA', hidden: false },
    vcard: {
      firstName: '',
      lastName: '',
      phone: '',
      mobile: '',
      email: '',
      website: '',
      company: '',
      jobTitle: '',
      street: '',
      zip: '',
      city: '',
      country: '',
    },
    event: { title: '', location: '', start: '', end: '', allDay: false, description: '' },
  };
}

/* ── Normalisers ───────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Add `https://` when no scheme is present (`example.com` → `https://example.com`). */
export function normalizeUrl(input: string): string {
  const v = input.trim();
  if (!v) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  return `https://${v}`;
}

export function isValidUrl(input: string): boolean {
  const v = normalizeUrl(input);
  if (!v) return false;
  try {
    const u = new URL(v);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.hostname === 'localhost' || /\.[a-z0-9-]{2,}$/i.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname);
    }
    return true; // other schemes (tel:, geo:, custom app links…) are allowed as-is
  } catch {
    return false;
  }
}

export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}

/** Keep `+` and digits; `00` international prefix becomes `+`. */
export function normalizePhone(input: string): string {
  let v = input.trim().replace(/[^\d+]/g, '');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  // Only one leading +
  v = v.replace(/(?!^)\+/g, '');
  return v;
}

export function isValidPhone(input: string): boolean {
  const digits = normalizePhone(input).replace(/\D/g, '');
  return digits.length >= 3 && digits.length <= 17;
}

/** `WIFI:` field escaping (ZXing): `\` `;` `,` `:` `"`. */
export function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/** vCard 3.0 / iCalendar text escaping (RFC 2426 / RFC 5545). */
export function escapeVText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** `2026-10-30T19:00` → `20261030T190000` · `2026-10-30` → `20261030`. */
export function toICalDate(input: string, allDay: boolean): string {
  const v = input.trim();
  if (allDay) {
    const d = DATE_RE.exec(v.slice(0, 10));
    return d ? `${d[1]}${d[2]}${d[3]}` : '';
  }
  const m = DATETIME_RE.exec(v);
  if (!m) return '';
  return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6] ?? '00'}`;
}

function parseLocal(input: string, allDay: boolean): number | null {
  const v = input.trim();
  if (allDay) {
    const d = DATE_RE.exec(v.slice(0, 10));
    return d ? Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!) : null;
  }
  const m = DATETIME_RE.exec(v);
  return m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0)) : null;
}

/** Day after `YYYY-MM-DD` (all-day DTEND is exclusive). */
function nextDay(date: string): string {
  const t = parseLocal(date, true);
  if (t == null) return '';
  const d = new Date(t + 86_400_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

/* ── Validation ────────────────────────────────────────────────────────── */

export function validateQrPayload<K extends QrContentType>(
  type: K,
  data: QrPayloadMap[K],
): QrFieldErrors {
  const e: QrFieldErrors = {};
  switch (type) {
    case 'link': {
      const d = data as QrLinkData;
      if (!d.url.trim()) e.url = 'required';
      else if (!isValidUrl(d.url)) e.url = 'url';
      break;
    }
    case 'text': {
      const d = data as QrTextData;
      if (!d.text.trim()) e.text = 'required';
      break;
    }
    case 'email': {
      const d = data as QrEmailData;
      if (!d.to.trim()) e.to = 'required';
      else if (!isValidEmail(d.to)) e.to = 'email';
      break;
    }
    case 'phone': {
      const d = data as QrPhoneData;
      if (!d.phone.trim()) e.phone = 'required';
      else if (!isValidPhone(d.phone)) e.phone = 'phone';
      break;
    }
    case 'sms':
    case 'whatsapp': {
      const d = data as QrSmsData;
      if (!d.phone.trim()) e.phone = 'required';
      else if (!isValidPhone(d.phone)) e.phone = 'phone';
      break;
    }
    case 'wifi': {
      const d = data as QrWifiData;
      if (!d.ssid.trim()) e.ssid = 'required';
      if (d.encryption !== 'nopass' && !d.password) e.password = 'required';
      break;
    }
    case 'vcard': {
      const d = data as QrVCardData;
      if (!d.firstName.trim() && !d.lastName.trim() && !d.company.trim()) e.firstName = 'name';
      if (d.email.trim() && !isValidEmail(d.email)) e.email = 'email';
      if (d.website.trim() && !isValidUrl(d.website)) e.website = 'url';
      for (const k of ['phone', 'mobile'] as const) {
        if (d[k].trim() && !isValidPhone(d[k])) e[k] = 'phone';
      }
      break;
    }
    case 'event': {
      const d = data as QrEventData;
      if (!d.title.trim()) e.title = 'required';
      const start = parseLocal(d.start, d.allDay);
      if (!d.start.trim()) e.start = 'required';
      else if (start == null) e.start = 'date';
      if (d.end.trim()) {
        const end = parseLocal(d.end, d.allDay);
        if (end == null) e.end = 'date';
        else if (start != null && end < start) e.end = 'endBeforeStart';
      }
      break;
    }
  }
  return e;
}

/* ── Builders ──────────────────────────────────────────────────────────── */

/**
 * Build the string to encode. Returns `''` while required data is missing
 * (the QR component then shows its empty state).
 */
export function buildQrPayload<K extends QrContentType>(type: K, data: QrPayloadMap[K]): string {
  const errors = validateQrPayload(type, data);
  if (Object.keys(errors).length) return '';

  switch (type) {
    case 'link':
      return normalizeUrl((data as QrLinkData).url);

    case 'text':
      return (data as QrTextData).text;

    case 'email': {
      const d = data as QrEmailData;
      const params: string[] = [];
      if (d.subject.trim()) params.push(`subject=${encodeURIComponent(d.subject.trim())}`);
      if (d.body.trim()) params.push(`body=${encodeURIComponent(d.body)}`);
      return `mailto:${d.to.trim()}${params.length ? `?${params.join('&')}` : ''}`;
    }

    case 'phone':
      return `tel:${normalizePhone((data as QrPhoneData).phone)}`;

    case 'sms': {
      const d = data as QrSmsData;
      return `SMSTO:${normalizePhone(d.phone)}:${d.message}`;
    }

    case 'whatsapp': {
      const d = data as QrWhatsAppData;
      const number = normalizePhone(d.phone).replace(/\D/g, '');
      const text = d.message.trim() ? `?text=${encodeURIComponent(d.message)}` : '';
      return `https://wa.me/${number}${text}`;
    }

    case 'wifi': {
      const d = data as QrWifiData;
      const t = d.encryption === 'nopass' ? 'nopass' : d.encryption;
      let s = `WIFI:T:${t};S:${escapeWifi(d.ssid)};`;
      if (t !== 'nopass') s += `P:${escapeWifi(d.password)};`;
      if (d.hidden) s += 'H:true;';
      return `${s};`;
    }

    case 'vcard': {
      const d = data as QrVCardData;
      const v = (s: string) => escapeVText(s.trim());
      const full = [d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(' ') || d.company.trim();
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${v(d.lastName)};${v(d.firstName)};;;`, `FN:${escapeVText(full)}`];
      if (d.company.trim()) lines.push(`ORG:${v(d.company)}`);
      if (d.jobTitle.trim()) lines.push(`TITLE:${v(d.jobTitle)}`);
      if (d.phone.trim()) lines.push(`TEL;TYPE=WORK,VOICE:${normalizePhone(d.phone)}`);
      if (d.mobile.trim()) lines.push(`TEL;TYPE=CELL:${normalizePhone(d.mobile)}`);
      if (d.email.trim()) lines.push(`EMAIL;TYPE=INTERNET:${d.email.trim()}`);
      if (d.website.trim()) lines.push(`URL:${normalizeUrl(d.website)}`);
      if (d.street.trim() || d.city.trim() || d.zip.trim() || d.country.trim()) {
        lines.push(`ADR;TYPE=WORK:;;${v(d.street)};${v(d.city)};;${v(d.zip)};${v(d.country)}`);
      }
      lines.push('END:VCARD');
      return lines.join('\r\n');
    }

    case 'event': {
      const d = data as QrEventData;
      const lines = ['BEGIN:VEVENT', `SUMMARY:${escapeVText(d.title.trim())}`];
      if (d.allDay) {
        const start = toICalDate(d.start, true);
        const endDay = d.end.trim() ? toICalDate(d.end, true) : start;
        lines.push(`DTSTART;VALUE=DATE:${start}`);
        lines.push(`DTEND;VALUE=DATE:${nextDay(`${endDay.slice(0, 4)}-${endDay.slice(4, 6)}-${endDay.slice(6, 8)}`)}`);
      } else {
        lines.push(`DTSTART:${toICalDate(d.start, false)}`);
        if (d.end.trim()) lines.push(`DTEND:${toICalDate(d.end, false)}`);
      }
      if (d.location.trim()) lines.push(`LOCATION:${escapeVText(d.location.trim())}`);
      if (d.description.trim()) lines.push(`DESCRIPTION:${escapeVText(d.description.trim())}`);
      lines.push('END:VEVENT');
      return lines.join('\r\n');
    }
  }
  return '';
}

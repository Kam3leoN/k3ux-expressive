import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/media/audio-player.js';
import type { K3AudioPlayer } from '../../src/components/media/audio-player.js';
import {
  ensureAudioPlayerDeps,
  resolveAudioPlayerVariant,
} from '../../src/components/media/audio-player.js';

describe('k3-audio-player', () => {
  let el: K3AudioPlayer;

  beforeEach(async () => {
    localStorage.removeItem('k3-music-muted');
    await ensureAudioPlayerDeps();
    el = document.createElement('k3-audio-player') as K3AudioPlayer;
    el.tracks = [
      { src: '/sounds/track-a.wav', title: 'A', type: 'audio/wav', seed: '#6750A4' },
      { src: '/sounds/track-b.wav', title: 'B', type: 'audio/wav', seed: '#E8A0BF' },
    ];
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
  });

  it('registers and exposes transport controls', () => {
    expect(customElements.get('k3-audio-player')).toBeTruthy();
    expect(customElements.get('k3-audio-seek')).toBeTruthy();
    expect(typeof el.play).toBe('function');
    expect(typeof el.pause).toBe('function');
    expect(typeof el.stop).toBe('function');
    expect(typeof el.next).toBe('function');
    expect(typeof el.prev).toBe('function');
    expect(typeof el.seek).toBe('function');
    expect(el.getAttribute('role')).toBe('region');
    expect(el.variant).toBe('card');
  });

  it('card transport is Noph-style button-group (narrow / wide / narrow)', async () => {
    const group = el.shadowRoot?.querySelector('k3-button-group.transport');
    expect(group).toBeTruthy();
    expect(group?.getAttribute('variant')).toBe('standard');
    expect(group?.getAttribute('selection')).toBe('none');
    const prev = group?.querySelector('k3-icon-button[part="prev"]');
    const play = group?.querySelector('k3-icon-button[part="play"]');
    const next = group?.querySelector('k3-icon-button[part="next"]');
    expect(prev?.getAttribute('width')).toBe('narrow');
    expect(prev?.getAttribute('variant')).toBe('tonal');
    expect(prev?.getAttribute('size')).toBe('md');
    expect(next?.getAttribute('width')).toBe('narrow');
    expect(play?.getAttribute('width')).toBe('wide');
    expect(play?.getAttribute('size')).toBe('md');
    expect(play?.getAttribute('variant')).toBe('filled');
    expect(play?.getAttribute('shape')).toBe('round');
  });

  it('compact matches play size on prev/next; phone steps up to lg', async () => {
    el.variant = 'compact';
    await el.updateComplete;
    const compact = el.shadowRoot?.querySelector('k3-button-group.transport');
    for (const part of ['prev', 'play', 'next'] as const) {
      expect(compact?.querySelector(`k3-icon-button[part="${part}"]`)?.getAttribute('size')).toBe(
        'md',
      );
    }

    el.variant = 'phone';
    await el.updateComplete;
    const phone = el.shadowRoot?.querySelector('k3-button-group.transport');
    for (const part of ['prev', 'play', 'next'] as const) {
      expect(phone?.querySelector(`k3-icon-button[part="${part}"]`)?.getAttribute('size')).toBe(
        'lg',
      );
    }
  });

  it('renders title and artist as marquee lines (not ellipsis boxes)', async () => {
    el.tracks = [
      {
        src: '/sounds/hello.mp3',
        title: 'Hello',
        artist: 'Porter Robinson & Lazy Rich feat. Sue Cho',
        type: 'audio/mpeg',
      },
    ];
    await el.updateComplete;
    const title = el.shadowRoot?.querySelector('.title .meta-marquee');
    const artist = el.shadowRoot?.querySelector('.artist .meta-marquee');
    expect(title).toBeTruthy();
    expect(artist).toBeTruthy();
    expect(title?.querySelector('.meta-label.ghost')).toBeTruthy();
    expect(artist?.textContent).toContain('Porter Robinson');
  });

  it('resolves legacy aliases', () => {
    expect(resolveAudioPlayerVariant('smartphone')).toBe('phone');
    expect(resolveAudioPlayerVariant('overlay')).toBe('sticky');
    expect(resolveAudioPlayerVariant('toolbar')).toBe('toolbar');
    expect(resolveAudioPlayerVariant('full')).toBe('full');
    expect(resolveAudioPlayerVariant('compact')).toBe('compact');
  });

  it('supports compact, toolbar, sticky, phone and full variants', async () => {
    for (const v of ['compact', 'toolbar', 'sticky', 'phone', 'full'] as const) {
      el.variant = v;
      await el.updateComplete;
      expect(el.resolvedVariant).toBe(v);
    }
  });

  it('compact shows volume trigger inside the button-group without playlist', async () => {
    el.variant = 'compact';
    await el.updateComplete;
    const group = el.shadowRoot?.querySelector('.extras-row k3-button-group');
    expect(group).toBeTruthy();
    expect(group?.getAttribute('variant')).toBe('connected');
    expect(group?.querySelector('k3-button[part="playlist"]')).toBeFalsy();
    expect(el.shadowRoot?.querySelector('.vol-toolbar')).toBeFalsy();
    const volBtn = el.shadowRoot?.querySelector('k3-button[part="volume-open"]');
    expect(volBtn).toBeTruthy();
    expect(group?.contains(volBtn!)).toBe(true);
    for (const part of ['repeat', 'shuffle', 'like', 'volume-open']) {
      expect(group?.querySelector(`k3-button[part="${part}"]`)).toBeTruthy();
    }
    volBtn!.dispatchEvent(new CustomEvent('k3-click', { bubbles: true, composed: true }));
    await el.updateComplete;
    const toolbar = el.shadowRoot?.querySelector('.vol-toolbar');
    expect(toolbar).toBeTruthy();
    expect(toolbar?.querySelector('k3-icon-button[part="mute"]')).toBeTruthy();
  });

  it('card centers extras with the connected media group (one queue/lyrics control)', async () => {
    el.variant = 'card';
    await el.updateComplete;
    const group = el.shadowRoot?.querySelector('.extras-row k3-button-group');
    expect(group).toBeTruthy();
    for (const part of ['repeat', 'shuffle', 'like', 'playlist', 'volume-open']) {
      const btn = group?.querySelector(`k3-button[part="${part}"]`);
      expect(btn).toBeTruthy();
      expect(btn?.closest('k3-tooltip')).toBeTruthy();
    }
    expect(group?.querySelector('k3-button[part="lyrics"]')).toBeFalsy();
    const repeatBtn = group?.querySelector('k3-button[part="repeat"]') as HTMLElement & {
      selected?: boolean;
    };
    expect(repeatBtn?.selected || repeatBtn?.hasAttribute('selected')).toBeFalsy();
  });

  it('phone has no topbar and a compact connected media group', async () => {
    el.variant = 'phone';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.topbar')).toBeFalsy();
    const seg = el.shadowRoot?.querySelector('.utility k3-button-group');
    expect(seg).toBeTruthy();
    expect(seg?.getAttribute('variant')).toBe('connected');
    expect(seg?.getAttribute('size')).toBe('sm');
    for (const part of ['repeat', 'shuffle', 'like', 'playlist', 'volume-open']) {
      expect(seg?.querySelector(`k3-button[part="${part}"]`)).toBeTruthy();
    }
    expect(seg?.querySelector('k3-button[part="lyrics"]')).toBeFalsy();
    expect(seg?.querySelector('k3-button[part="speed"]')).toBeFalsy();
  });

  it('full puts speed inside the connected media group and centers transport', async () => {
    el.variant = 'full';
    await el.updateComplete;
    const seg = el.shadowRoot?.querySelector('.utility k3-button-group');
    expect(seg?.querySelector('k3-button[part="speed"]')).toBeTruthy();
    expect(el.shadowRoot?.querySelector('.utility > .speed, .utility > k3-tooltip > .speed')).toBeFalsy();
    const speedInGroup = seg?.querySelector('k3-button[part="speed"]');
    expect(speedInGroup?.closest('k3-tooltip')).toBeTruthy();
  });

  it('phone panel opens above the body and exposes a drag handle', async () => {
    el.variant = 'phone';
    await el.updateComplete;
    (el as unknown as { panelOpen: boolean }).panelOpen = true;
    await el.updateComplete;
    const panel = el.shadowRoot?.querySelector('.full.is-phone > .panel.is-open');
    expect(panel).toBeTruthy();
    expect(el.shadowRoot?.querySelector('.panel-head .grip')).toBeTruthy();
    expect(panel?.querySelector('k3-button-segmented.tabs')).toBeTruthy();
  });

  it('phone cover keeps a rem-sized morph target', async () => {
    el.variant = 'phone';
    await el.updateComplete;
    const cover = el.shadowRoot?.querySelector('.is-phone .now .cover') as HTMLElement | null;
    expect(cover).toBeTruthy();
    expect(cover?.querySelector('svg path.clip-shape, svg .clip-shape')).toBeTruthy();
  });

  it('toolbar uses the connected media group (one queue/lyrics control)', async () => {
    el.variant = 'toolbar';
    await el.updateComplete;
    const group = el.shadowRoot?.querySelector('.bar-extras k3-button-group');
    expect(group).toBeTruthy();
    for (const part of ['repeat', 'shuffle', 'like', 'playlist', 'volume-open']) {
      expect(group?.querySelector(`k3-button[part="${part}"]`)).toBeTruthy();
    }
    expect(group?.querySelector('k3-button[part="lyrics"]')).toBeFalsy();
    expect(el.shadowRoot?.querySelector('.bar-volume')).toBeFalsy();
  });

  it('toolbar click docks sticky without opening a sheet', async () => {
    el.variant = 'toolbar';
    el.expandable = true;
    await el.updateComplete;
    const stickyEvt = vi.fn();
    const expandEvt = vi.fn();
    el.addEventListener('k3-sticky', stickyEvt);
    el.addEventListener('k3-expand', expandEvt);

    const open = el.shadowRoot?.querySelector<HTMLButtonElement>('.bar-open');
    expect(open).toBeTruthy();
    expect(open?.disabled).toBe(false);
    open!.click();
    await el.updateComplete;

    expect(el.resolvedVariant).toBe('sticky');
    expect(el.expanded).toBe(false);
    expect(el.hasAttribute('data-sticky-dock')).toBe(true);
    expect(el.hasAttribute('data-sheet-open')).toBe(false);
    expect(stickyEvt).toHaveBeenCalled();
    expect(expandEvt).not.toHaveBeenCalled();
  });

  it('dock-toggle undocks sticky back to toolbar (demo)', async () => {
    el.variant = 'toolbar';
    el.dockToggle = true;
    await el.updateComplete;
    el.shadowRoot?.querySelector<HTMLButtonElement>('.bar-open')!.click();
    await el.updateComplete;
    expect(el.resolvedVariant).toBe('sticky');

    const open = el.shadowRoot?.querySelector<HTMLButtonElement>('.bar-open');
    expect(open?.disabled).toBe(false);
    open!.click();
    await el.updateComplete;
    expect(el.resolvedVariant).toBe('toolbar');
    expect(el.hasAttribute('data-sticky-dock')).toBe(false);
  });

  it('sticky without dock-toggle stays pinned', async () => {
    el.variant = 'toolbar';
    el.dockToggle = false;
    await el.updateComplete;
    el.shadowRoot?.querySelector<HTMLButtonElement>('.bar-open')!.click();
    await el.updateComplete;
    expect(el.resolvedVariant).toBe('sticky');
    const open = el.shadowRoot?.querySelector<HTMLButtonElement>('.bar-open');
    expect(open?.disabled).toBe(true);
  });

  it('card expandable opens sheet; toolbar never opens a sheet', async () => {
    el.variant = 'card';
    el.expandable = true;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.card-head k3-icon-button[label], .card-head k3-icon-button')).toBeTruthy();
    el.expanded = true;
    await el.updateComplete;
    expect(el.hasAttribute('data-sheet-open')).toBe(true);

    el.expanded = false;
    el.variant = 'toolbar';
    el.expandable = true;
    await el.updateComplete;
    expect(el.hasAttribute('data-sheet-open')).toBe(false);
    el.expanded = true;
    await el.updateComplete;
    /* expandable on toolbar must not elevate a sheet */
    expect(el.hasAttribute('data-sheet-open')).toBe(false);
  });

  it('maps smartphone/overlay attributes to phone/sticky', async () => {
    el.setAttribute('variant', 'smartphone');
    await el.updateComplete;
    expect(el.resolvedVariant).toBe('phone');
    el.setAttribute('variant', 'overlay');
    await el.updateComplete;
    expect(el.resolvedVariant).toBe('sticky');
  });

  it('next advances track index', async () => {
    const onChange = vi.fn();
    el.addEventListener('k3-change', onChange);
    el.trackIndex = 0;
    el.next();
    await el.updateComplete;
    expect(el.trackIndex).toBe(1);
  });

  it('queue rows use three lines with total duration', async () => {
    el.variant = 'full';
    el.tracks = [
      {
        src: '/sounds/a.mp3',
        title: 'Snowflakes',
        artist: 'White Apple Tree',
        duration: 216,
        seed: '#7EB8DA',
      },
      {
        src: '/sounds/b.mp3',
        title: 'Hello',
        artist: 'Porter Robinson & Lazy Rich feat. Sue Cho',
        duration: 242,
        seed: '#C4D82E',
      },
    ];
    await el.updateComplete;
    const items = el.shadowRoot?.querySelectorAll('k3-list.queue k3-list-item');
    expect(items?.length).toBe(2);
    expect(items?.[0]?.getAttribute('lines')).toBe('three');
    const supporting = items?.[0]?.querySelector('[slot="supporting"]');
    expect(supporting?.textContent).toContain('White Apple Tree');
    expect(supporting?.textContent).toContain('3:36');
  });

  it('music mute is independent storage key', () => {
    el.setMusicMuted(true);
    expect(el.muted).toBe(true);
    expect(localStorage.getItem('k3-music-muted')).toBe('1');
  });

  it('hotkeys fire only when hotkeys is set and host is visible', async () => {
    const toggle = vi.spyOn(el, 'toggle');
    el.hotkeys = true;
    await el.updateComplete;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(toggle).toHaveBeenCalled();
    toggle.mockClear();

    const wrap = document.createElement('div');
    wrap.hidden = true;
    document.body.appendChild(wrap);
    wrap.appendChild(el);
    await el.updateComplete;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(toggle).not.toHaveBeenCalled();

    wrap.remove();
    document.body.appendChild(el);
  });

  it('only the first visible hotkeys player handles keys', async () => {
    el.hotkeys = true;
    await el.updateComplete;
    const second = document.createElement('k3-audio-player') as K3AudioPlayer;
    second.tracks = el.tracks;
    second.hotkeys = true;
    document.body.appendChild(second);
    await second.updateComplete;

    const t1 = vi.spyOn(el, 'toggle');
    const t2 = vi.spyOn(second, 'toggle');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    expect(t1).toHaveBeenCalled();
    expect(t2).not.toHaveBeenCalled();
    second.remove();
  });

  it('skip / share / download stay off by default on card', async () => {
    el.variant = 'card';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[part="skip-back"]')).toBeFalsy();
    expect(el.shadowRoot?.querySelector('[part="skip-forward"]')).toBeFalsy();
    expect(el.shadowRoot?.querySelector('k3-button[part="share"]')).toBeFalsy();
    expect(el.shadowRoot?.querySelector('k3-button[part="download"]')).toBeFalsy();
  });

  it('full shows opt-in skip · share · download and oscillation seek', async () => {
    el.variant = 'full';
    el.skipBack = 15;
    el.skipForward = 30;
    el.showShare = true;
    el.showDownload = true;
    el.seekStyle = 'oscillation';
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('[part="skip-back"]')).toBeTruthy();
    expect(el.shadowRoot?.querySelector('[part="skip-forward"]')).toBeTruthy();
    const group = el.shadowRoot?.querySelector('.utility k3-button-group');
    expect(group?.querySelector('k3-button[part="share"]')).toBeTruthy();
    expect(group?.querySelector('k3-button[part="download"]')).toBeTruthy();
    const seek = el.shadowRoot?.querySelector('k3-audio-seek');
    expect(seek?.getAttribute('mode')).toBe('oscillation');
    /* PCM decode uses the track URL — no procedural wave-seed. */
    expect(seek?.getAttribute('src')).toBe('/sounds/track-a.wav');
    expect(seek?.hasAttribute('wave-seed')).toBe(false);
  });

  it('phone never shows skip / share / download even when props are set', async () => {
    el.variant = 'phone';
    el.skipBack = 15;
    el.skipForward = 30;
    el.showShare = true;
    el.showDownload = true;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[part="skip-back"]')).toBeFalsy();
    expect(el.shadowRoot?.querySelector('[part="skip-forward"]')).toBeFalsy();
    expect(el.shadowRoot?.querySelector('k3-button[part="share"]')).toBeFalsy();
    expect(el.shadowRoot?.querySelector('k3-button[part="download"]')).toBeFalsy();
  });

  it('sheet (card + expandable) surfaces skip / share when enabled', async () => {
    el.variant = 'card';
    el.expandable = true;
    el.skipBack = 15;
    el.skipForward = 30;
    el.showShare = true;
    el.showDownload = true;
    el.expanded = true;
    await el.updateComplete;
    const sheet = el.shadowRoot?.querySelector('.full.sheet');
    expect(sheet).toBeTruthy();
    expect(sheet?.querySelector('[part="skip-back"]')).toBeTruthy();
    expect(sheet?.querySelector('[part="skip-forward"]')).toBeTruthy();
    expect(sheet?.querySelector('k3-button[part="share"]')).toBeTruthy();
    expect(sheet?.querySelector('k3-button[part="download"]')).toBeTruthy();
  });

  it('skipBy seeks relatively and share/download emit events', async () => {
    const share = vi.fn();
    const download = vi.fn();
    el.addEventListener('k3-share', share);
    el.addEventListener('k3-download', download);
    el.seek(40);
    el.skipBy(-15);
    expect(el['currentTime']).toBeLessThanOrEqual(40);

    await el.shareTrack();
    el.downloadTrack();
    expect(share).toHaveBeenCalled();
    expect(download).toHaveBeenCalled();
  });

  it('preventDefault on k3-share / k3-download blocks the default action', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    const createEl = vi.spyOn(document, 'createElement');
    const shareSpy = vi.fn((e: Event) => e.preventDefault());
    const downloadSpy = vi.fn((e: Event) => e.preventDefault());
    el.addEventListener('k3-share', shareSpy);
    el.addEventListener('k3-download', downloadSpy);

    await el.shareTrack();
    el.downloadTrack();

    expect(shareSpy).toHaveBeenCalled();
    expect(downloadSpy).toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(createEl.mock.calls.some((c) => c[0] === 'a')).toBe(false);
    createEl.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).share;
  });
});

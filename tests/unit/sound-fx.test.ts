import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSoundFx,
  resetSoundFxForTests,
} from '../../src/core/sound-fx.js';
import '../../src/components/feedback/sound-fx.js';
import type { K3SoundFx } from '../../src/components/feedback/sound-fx.js';

describe('sound-fx', () => {
  beforeEach(() => {
    resetSoundFxForTests();
    document.body.innerHTML = '';
    localStorage.removeItem('k3-sfx-muted');
  });

  afterEach(() => {
    resetSoundFxForTests();
    document.body.innerHTML = '';
  });

  it('k3-sound-fx registers and toggles mute', async () => {
    const el = document.createElement('k3-sound-fx') as K3SoundFx;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(customElements.get('k3-sound-fx')).toBeTruthy();
    el.setMuted(true);
    expect(el.muted).toBe(true);
    expect(getSoundFx().isMuted()).toBe(true);
    el.setMuted(false);
    expect(getSoundFx().isMuted()).toBe(false);
    el.remove();
  });

  it('wires data-k3-sound-click without throwing', () => {
    const fx = getSoundFx({ enabled: true, soundsPath: '/sounds/' });
    fx.attach(document);
    const btn = document.createElement('button');
    btn.setAttribute('data-k3-sound-click', 'click');
    document.body.appendChild(btn);
    fx.scan(document);
    expect(() => {
      btn.click();
      fx.stopAll();
    }).not.toThrow();
  });

  it('muted SFX skips play', () => {
    const fx = getSoundFx({ enabled: true, soundsPath: '/sounds/' });
    fx.setMuted(true);
    expect(fx.isMuted()).toBe(true);
    expect(() => fx.play('click', 'click')).not.toThrow();
  });
});

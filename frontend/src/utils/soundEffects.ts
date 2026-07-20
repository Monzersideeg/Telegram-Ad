/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('sound_effects_enabled');
  return saved === null ? true : saved === 'true';
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sound_effects_enabled', String(enabled));
}

export function playClickSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // A quick high-pitch to low-pitch satisfying click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.06);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.07);
  } catch (error) {
    console.warn('Click sound failed to synthesize', error);
  }
}

export function playSuccessSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Upward sparkly major chime: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.07;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Use triangle wave for a warm retro chime sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  } catch (error) {
    console.warn('Success sound failed to synthesize', error);
  }
}

export function playSpinSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const playTick = (time: number, volume = 0.08) => {
      const now = ctx.currentTime + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.015);
      
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.02);
    };

    let currentDelay = 0;
    const ticks: number[] = [];
    let interval = 200; // ms

    while (currentDelay < 4000) {
      ticks.push(currentDelay / 1000); // convert to seconds
      
      if (currentDelay < 800) {
        // Accelerating
        interval = 200 - (currentDelay / 800) * 150;
      } else if (currentDelay < 2000) {
        // High speed
        interval = 50;
      } else {
        // Decelerating
        const progress = (currentDelay - 2000) / 2000; // 0 to 1
        interval = 50 + progress * progress * 400;
      }
      
      currentDelay += interval;
    }

    ticks.forEach((tickTime) => {
      const volume = tickTime > 3.0 ? 0.04 : 0.07;
      playTick(tickTime, volume);
    });
  } catch (error) {
    console.warn('Spin sound failed to synthesize', error);
  }
}


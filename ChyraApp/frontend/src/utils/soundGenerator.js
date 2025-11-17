// Generate simple notification sounds using Web Audio API
export class SoundGenerator {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
  }

  initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playBeep(frequency = 800, duration = 200, volume = 0.3) {
    if (!this.enabled) return;

    try {
      this.initAudioContext();
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Could not play sound:', error);
    }
  }

  // Message received sound (pleasant double beep)
  messageSound() {
    this.playBeep(800, 100, 0.2);
    setTimeout(() => this.playBeep(1000, 100, 0.2), 120);
  }

  // Notification sound (single higher beep)
  notificationSound() {
    this.playBeep(1200, 150, 0.25);
  }

  // Message sent sound (quick swoosh)
  sentSound() {
    this.playBeep(600, 80, 0.15);
    setTimeout(() => this.playBeep(400, 60, 0.1), 50);
  }

  // Call sound (repeating pattern)
  callSound() {
    const pattern = [800, 1000, 800, 1000];
    pattern.forEach((freq, index) => {
      setTimeout(() => this.playBeep(freq, 300, 0.3), index * 400);
    });
  }

  toggle(enabled) {
    this.enabled = enabled;
  }
}

export const soundGenerator = new SoundGenerator();
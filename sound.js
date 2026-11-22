const FILES = ['strike-1','strike-2','strike-3','strike-4','strike-5','strike-6','space','bell','return','stop','tear'];

/** Recorded mechanisms, decoded once. Audio follows the visual carriage's timing. */
export class MechanicalSound {
  constructor() {
    this.enabled = true;
    this.volume = .65;
    this.context = null;
    this.buffers = new Map();
    this.lastStrike = -1;
    this.error = null;
    this.loading = null;
  }
  prime() {
    if (this.loading) return this.loading;
    this.createContext();
    this.loading = Promise.all(FILES.map(async name => {
      const response = await fetch(new URL(`./assets/audio/${name}.wav`, import.meta.url));
      if (!response.ok) throw new Error(`Could not load ${name}`);
      return [name, await response.arrayBuffer()];
    })).then(async files => {
      this.files = files;
      if (this.context) await Promise.all(files.map(async ([name,data]) => this.buffers.set(name, await this.context.decodeAudioData(data.slice(0)))));
    }).catch(e => { this.error = e; });
    return this.loading;
  }
  createContext() {
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.context = new AudioContext({ latencyHint: 'interactive' });
        this.master = this.context.createGain();
        this.master.gain.value = this.volume * .7;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -9; compressor.ratio.value = 3;
        this.master.connect(compressor); compressor.connect(this.context.destination);
      }
    } catch(e) { this.error = e; }
  }
  async unlock() {
    try {
      this.createContext();
      if (!this.context) return;
      if (this.context.state === 'suspended') await this.context.resume();
      await this.prime();

    } catch(e) { this.error = e; }
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.setTargetAtTime(this.volume * .7, this.context.currentTime, .03);
  }
  play(name, { gain = 1, rate = 1, delay = 0, pan = 0 } = {}) {
    if (!this.enabled) return;
    if (!this.context || this.context.state !== 'running' || !this.buffers.has(name)) {
      const requested = performance.now();
      this.unlock().then(() => {if(performance.now()-requested<180 && this.context?.state==='running' && this.buffers.has(name)) this.play(name,{gain,rate,delay,pan});});
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(name); source.playbackRate.value = rate;
    const level = this.context.createGain(); level.gain.value = gain;
    source.connect(level);
    if (this.context.createStereoPanner) {
      const panner = this.context.createStereoPanner(); panner.pan.value = pan;
      level.connect(panner); panner.connect(this.master);
      source.onended = () => {source.disconnect();level.disconnect();panner.disconnect();};
    } else {
      level.connect(this.master); source.onended = () => {source.disconnect();level.disconnect();};
    }
    source.start(this.context.currentTime + delay);
  }
  strike(column) {
    let index = Math.floor(Math.random() * 6);
    if (index === this.lastStrike) index = (index + 1) % 6;
    this.lastStrike = index;
    this.play(`strike-${index + 1}`, {gain: .85 + Math.random() * .15, rate: .985 + Math.random() * .03, pan: (column / 68 - .5) * .16});
  }
  space() { this.play('space', {gain: .65, rate: .97 + Math.random() * .06}); }
  shift() { this.play('space', {gain: .32, rate: .78}); }
  bell() { this.play('bell', {gain: .66, pan: .22}); }
  locked() { this.play('space', {gain: .23, rate: .7}); }
  carriage(duration, distance) {
    if (distance > 0) {
      const length = this.buffers.get('return')?.duration || .772;
      this.play('return', {gain: .8, rate: length / duration, pan: .05});
    } else this.play('space', {gain: .8, rate: .85});
    this.play('stop', {gain: .7, delay: distance > 0 ? duration - .025 : .07});
  }
}

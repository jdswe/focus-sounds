(function () {
  const instrumentPatterns = {
    piano: [[60, 64, 67, 69, 67, 64, 62, 65, 69, 72, 69, 65], [60, 64, 69, 72, 69, 67, 64, 62, 65, 69, 67, 64], [55, 59, 62, 67, 64, 62, 60, 64, 67, 71, 69, 64]],
    guitar: [[55, 59, 62, 64, 62, 59, 57, 60, 64, 67], [55, 60, 64, 67, 64, 60, 57, 62, 65, 69], [50, 55, 59, 62, 59, 55, 52, 57, 60, 64]],
    flute: [[72, 76, 79, 76, 74, 77, 81, 77, 72, 76], [74, 77, 81, 84, 81, 79, 76, 79, 84, 81], [69, 72, 76, 79, 76, 74, 72, 76, 79, 76]],
    kalimba: [[72, 76, 79, 84, 79, 76, 74, 79, 81, 76], [67, 71, 74, 79, 74, 71, 69, 74, 76, 71], [74, 77, 81, 86, 81, 77, 76, 81, 84, 77]],
    handpan: [[60, 63, 67, 70, 67, 63, 58, 63, 67, 72], [60, 65, 68, 72, 68, 65, 58, 62, 65, 70], [55, 60, 63, 67, 63, 60, 57, 62, 65, 69]]
  };

  const instrumentTimbres = {
    piano: { harmonics: [1, 0.56, 0.33, 0.2, 0.12, 0.07], length: 0.49, attack: 0.004, level: 0.16, inharmonicity: 0.00035 },
    guitar: { length: 0.49, attack: 0.006, level: 0.42 },
    flute: { harmonics: [1, 0.18, 0.04], length: 0.62, attack: 0.095, level: 0.15 },
    kalimba: { harmonics: [1, 0.42, 0.12, 0.04], length: 0.72, attack: 0.004, level: 0.19 },
    handpan: { harmonics: [1, 0.32, 0.14, 0.06], length: 1.15, attack: 0.018, level: 0.16 }
  };

  function createNoiseBuffer(context, kind) {
    const duration = 12;
    const frameCount = context.sampleRate * duration;
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    let pink0 = 0;
    let pink1 = 0;
    let pink2 = 0;
    let pink3 = 0;
    let pink4 = 0;
    let pink5 = 0;

    for (let i = 0; i < frameCount; i++) {
      const time = i / context.sampleRate;
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      const brownSample = brown * 3.5;
      pink0 = 0.99886 * pink0 + white * 0.0555179;
      pink1 = 0.99332 * pink1 + white * 0.0750759;
      pink2 = 0.969 * pink2 + white * 0.153852;
      pink3 = 0.8665 * pink3 + white * 0.3104856;
      pink4 = 0.55 * pink4 + white * 0.5329522;
      pink5 = -0.7616 * pink5 - white * 0.016898;
      const pinkSample = (pink0 + pink1 + pink2 + pink3 + pink4 + pink5 + white * 0.5362) * 0.11;

      if (kind === "brown") {
        data[i] = brownSample;
      } else if (kind === "white") {
        data[i] = white * 0.45;
      } else if (kind === "pink") {
        data[i] = pinkSample;
      } else if (kind === "wind") {
        const gust = 0.52 + 0.48 * Math.sin(time * 0.72 + Math.sin(time * 0.17) * 1.8);
        data[i] = (brownSample * 0.55 + pinkSample * 0.35) * gust;
      } else if (kind === "ocean") {
        const swell = 0.34 + 0.66 * (0.5 + 0.5 * Math.sin(time * 0.48 + Math.sin(time * 0.11)));
        data[i] = (brownSample * 0.55 + pinkSample * 0.35) * swell;
      } else {
        const dropPhase = time % 0.19;
        const drop = dropPhase < 0.012
          ? (Math.random() * 2 - 1) * (1 - dropPhase / 0.012) * 0.18
          : 0;
        data[i] = brownSample * 0.48 + white * 0.12 + drop;
      }
    }

    return buffer;
  }

  function createInstrumentBuffer(context, instrument) {
    const patterns = instrumentPatterns[instrument];
    const timbre = instrumentTimbres[instrument];
    const duration = patterns.length * 8;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const samples = buffer.getChannelData(0);
    patterns.forEach((pattern, sectionIndex) => {
      const noteSpacing = 8 / pattern.length;
      const transpose = sectionIndex === 1 ? 12 : sectionIndex === 2 ? -12 : 0;
      pattern.forEach((midi, noteIndex) => {
        const start = Math.floor((sectionIndex * 8 + noteIndex * noteSpacing) * context.sampleRate);
        const noteSamples = Math.min(Math.floor(timbre.length * context.sampleRate), samples.length - start);
        const frequency = 440 * Math.pow(2, (midi + transpose - 69) / 12);
        if (instrument === "guitar" || instrument === "kalimba") addPluckedString(samples, start, noteSamples, context.sampleRate, frequency, timbre);
        else addSustainedNote(samples, start, noteSamples, context.sampleRate, frequency, instrument, timbre);
      });
    });

    return buffer;
  }

  function addPluckedString(output, start, length, sampleRate, frequency, timbre) {
    const delay = Math.max(2, Math.round(sampleRate / frequency));
    const string = Float32Array.from({ length: delay }, () => Math.random() * 2 - 1);
    let cursor = 0;

    for (let i = 0; i < length; i++) {
      const next = (cursor + 1) % delay;
      const value = (string[cursor] + string[next]) * 0.5 * 0.996;
      string[cursor] = value;
      cursor = next;
      const time = i / sampleRate;
      const attack = Math.min(1, time / timbre.attack);
      const release = Math.exp(-time * 3.8);
      output[start + i] += value * attack * release * timbre.level;
    }
  }

  function addSustainedNote(output, start, length, sampleRate, frequency, instrument, timbre) {
    const phase = Math.random() * Math.PI * 2;
    for (let i = 0; i < length; i++) {
      const time = i / sampleRate;
      const attack = Math.min(1, time / timbre.attack);
      const release = instrument === "piano"
        ? Math.exp(-time * 5.2)
        : Math.min(1, (timbre.length - time) / 0.08);
      let tone = 0;

      timbre.harmonics.forEach((amplitude, harmonicIndex) => {
        const harmonic = harmonicIndex + 1;
        const bend = instrument === "piano"
          ? Math.sqrt(1 + timbre.inharmonicity * harmonic * harmonic)
          : harmonic;
        const vibrato = instrument === "flute"
          ? 1 + 0.002 * Math.sin(2 * Math.PI * 5.2 * time)
          : 1;
        tone += Math.sin(2 * Math.PI * frequency * bend * vibrato * time + phase) * amplitude;
      });

      const breath = instrument === "flute"
        ? (Math.random() * 2 - 1) * Math.exp(-time * 4) * 0.035
        : 0;
      output[start + i] += (tone * attack * release + breath) * timbre.level;
    }
  }

  // Places and nature: a noise bed plus sparse synthesized events (drops, birds, cups, pages).
  const placeDurations = { window: 12, river: 12, forest: 24, cafe: 24, library: 24 };

  function createPlaceBuffer(context, kind) {
    const rate = context.sampleRate;
    const duration = placeDurations[kind];
    const buffer = context.createBuffer(1, rate * duration, rate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    let pink = 0;
    let low = 0;
    const voices = [0, 1, 2].map(() => ({ rate: 3 + Math.random() * 2, phase: Math.random() * 6.28, drift: Math.random() * 6.28 }));

    for (let i = 0; i < data.length; i++) {
      const time = i / rate;
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      pink = 0.97 * pink + white * 0.15;
      low += 0.06 * (white - low);
      if (kind === "window") data[i] = brown * 0.9 + pink * 0.18;
      else if (kind === "river") data[i] = brown * 1.5 + pink * 0.4 * (0.75 + 0.25 * Math.sin(time * 2.3 + Math.sin(time * 0.7) * 2));
      else if (kind === "forest") data[i] = brown * 1.1 * (0.6 + 0.4 * Math.sin(time * 0.5 + Math.sin(time * 0.13) * 2));
      else if (kind === "cafe") {
        const murmur = voices.reduce((sum, voice) => sum + Math.max(0, Math.sin(2 * Math.PI * voice.rate * time + voice.phase + Math.sin(time * 0.3 + voice.drift) * 3)), 0) / 3;
        data[i] = brown * 0.9 + low * 0.9 * murmur;
      } else data[i] = brown * 0.55 + pink * 0.05 + Math.sin(2 * Math.PI * 60 * time) * 0.006;
    }

    const at = (seconds) => Math.floor(seconds * rate);
    const usable = duration - 0.6;
    const addBurst = (start, length, level, color) => {
      let previous = 0;
      for (let i = 0; i < length && start + i < data.length; i++) {
        const envelope = Math.sin(Math.PI * i / length) ** 2;
        const noise = Math.random() * 2 - 1;
        const sample = color === "bright" ? noise - previous : noise;
        previous = noise;
        data[start + i] += sample * envelope * level;
      }
    };
    const addTone = (start, seconds, from, to, level, decay) => {
      const length = at(seconds);
      let phase = 0;
      for (let i = 0; i < length && start + i < data.length; i++) {
        const progress = i / length;
        phase += 2 * Math.PI * (from + (to - from) * progress) / rate;
        const envelope = decay ? Math.exp(-progress * decay) : Math.sin(Math.PI * progress);
        data[start + i] += Math.sin(phase) * envelope * level;
      }
    };

    if (kind === "window") {
      for (let t = 0; t < usable; t += 0.02 + Math.random() * 0.09) addBurst(at(t), at(0.006 + Math.random() * 0.02), 0.04 + Math.random() * 0.16, "bright");
      for (let t = 0.3; t < usable; t += 0.4 + Math.random() * 1.1) addTone(at(t), 0.04, 2400 + Math.random() * 1600, 2200, 0.025, 6);
    } else if (kind === "river") {
      for (let t = 0; t < usable; t += 0.08 + Math.random() * 0.25) addTone(at(t), 0.05, 380 + Math.random() * 700, 900 + Math.random() * 500, 0.018, 3);
    } else if (kind === "forest") {
      for (let t = 0.8; t < usable - 1; t += 1.6 + Math.random() * 3) {
        const base = 2500 + Math.random() * 2000;
        const notes = 2 + Math.floor(Math.random() * 4);
        for (let n = 0; n < notes; n++) addTone(at(t + n * 0.16), 0.07 + Math.random() * 0.07, base, base + (Math.random() > 0.5 ? 650 : -500), 0.05, 0);
      }
    } else if (kind === "cafe") {
      for (let t = 1; t < usable; t += 2 + Math.random() * 4) {
        const pitch = 2800 + Math.random() * 1400;
        addTone(at(t), 0.35, pitch, pitch, 0.03, 9);
        addTone(at(t), 0.25, pitch * 2.7, pitch * 2.7, 0.012, 12);
      }
    } else if (kind === "library") {
      for (let t = 3; t < usable - 1; t += 6 + Math.random() * 8) addBurst(at(t), at(0.22 + Math.random() * 0.12), 0.05, "bright");
    }

    return buffer;
  }

  function createSoundBuffer(context, kind) {
    if (instrumentPatterns[kind]) return createInstrumentBuffer(context, kind);
    if (placeDurations[kind]) return createPlaceBuffer(context, kind);
    return createNoiseBuffer(context, kind);
  }

  window.StillApp = window.StillApp || {};
  window.StillApp.audioEngine = { createSoundBuffer };
})();

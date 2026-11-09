import { analyzeSamples } from './analysis.js';
import { measureLoudness, processPCM } from './audio-measurement.js';
self.onmessage = ({ data }) => {
  try {
    const result = data.measureLoudness ? (data.processing ? processPCM(data.channels, data.sampleRate, data.processing) : measureLoudness(data.channels, data.sampleRate)) : analyzeSamples(data.samples, data.sampleRate);
    self.postMessage({ result }, result.channels?.map(channel => channel.buffer) || []);
  }
  catch (error) { self.postMessage({ error: error.message }); }
};

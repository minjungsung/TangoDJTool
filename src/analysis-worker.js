import { analyzeSamples } from './analysis.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: analyzeSamples(data.samples, data.sampleRate) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};

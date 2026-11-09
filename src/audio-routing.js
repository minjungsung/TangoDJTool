export function validateChannels(channels, maximum = 2) {
  if (!Array.isArray(channels) || channels.length !== 2 || channels.some(channel => !Number.isInteger(channel) || channel < 1 || channel > maximum)) throw new Error(`Choose two output channels from 1 to ${maximum}.`);
  return [...channels];
}
export function channelGraph(context, source, channels, { deferred = false } = {}) {
  const mapping = validateChannels(channels, context.destination.maxChannelCount || 2);
  let connected = false;
  if (mapping[0] === 1 && mapping[1] === 2) {
    const graph = { connect() { if (context.destination.maxChannelCount) context.destination.channelCount = 2; source.connect(context.destination); connected = true; }, disconnect() { if (connected) source.disconnect?.(context.destination); connected = false; } };
    if (!deferred) graph.connect(); return graph;
  }
  if (!context.createChannelSplitter || !context.createChannelMerger) throw new Error('Channel mapping is unavailable in this browser.');
  const count = Math.max(2, ...mapping), adapter = context.createGain(), splitter = context.createChannelSplitter(2), merger = context.createChannelMerger(count), gains = [];
  adapter.channelCount = 2; adapter.channelCountMode = 'explicit';
  adapter.connect(splitter);
  for (let input = 0; input < 2; input++) {
    const gain = context.createGain(); gain.gain.value = mapping[0] === mapping[1] ? 0.5 : 1;
    splitter.connect(gain, input); gain.connect(merger, 0, mapping[input] - 1); gains.push(gain);
  }
  merger.connect(context.destination);
  const graph = {
    connect() { context.destination.channelCount = count; source.connect(adapter); connected = true; },
    disconnect() { if (connected) source.disconnect?.(adapter); connected = false; },
    dispose() { this.disconnect(); for (const node of [adapter, splitter, merger, ...gains]) node.disconnect?.(); },
  };
  if (!deferred) graph.connect(); return graph;
}

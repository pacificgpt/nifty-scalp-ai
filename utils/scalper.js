/**
 * Generate a scalp trading signal from extracted price levels.
 * @param {Object} levels - { high, low, close, support, resistance }
 * @returns {Object} Trading signal with action, entry, SL, TP, etc.
 */
function getScalpSignal(levels) {
  const price = levels.close;

  if (!price || price <= 0) {
    return {
      action: 'HOLD',
      entry: '0',
      stopLoss: '0',
      target1: '0',
      target2: '0',
      riskReward: 'N/A',
      confidence: 0,
      strategy: 'Iron Fortress Scalp',
      validFor: 'N/A',
      note: 'Could not determine valid price from chart',
    };
  }

  const sl = price * 0.997; // 0.3% stop
  const tp1 = price * 1.003; // 0.3% target
  const tp2 = price * 1.006; // 0.6% stretch
  const rr = ((tp1 - price) / (price - sl)).toFixed(2);

  // Safely handle support / resistance that may be -Infinity / Infinity
  const support = isFinite(levels.support) ? levels.support : null;
  const resistance = isFinite(levels.resistance) ? levels.resistance : null;

  let trend = 'NEUTRAL';
  if (support !== null && price > support) {
    trend = 'BULLISH';
  } else if (resistance !== null && price < resistance) {
    trend = 'BEARISH';
  }

  let strength = 'WEAK';
  if (support !== null && Math.abs(price - support) / price < 0.002) {
    strength = 'STRONG';
  }

  return {
    action: trend === 'BULLISH' ? 'BUY' : trend === 'BEARISH' ? 'SELL' : 'HOLD',
    entry: price.toFixed(0),
    stopLoss: sl.toFixed(0),
    target1: tp1.toFixed(0),
    target2: tp2.toFixed(0),
    riskReward: `1:${rr}`,
    confidence: strength === 'STRONG' ? 92 : 78,
    strategy: 'Iron Fortress Scalp (0.3% move in 5-15 min)',
    validFor: 'Next 15 minutes',
    support: support !== null ? support.toFixed(0) : 'N/A',
    resistance: resistance !== null ? resistance.toFixed(0) : 'N/A',
    note: 'Enter only if volume spike + candle close above support',
  };
}

module.exports = { getScalpSignal };

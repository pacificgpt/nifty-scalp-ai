function getScalpSignal(levels) {
  const price = levels.close;
  const sl = price * 0.997;     // 0.3% stop
  const tp1 = price * 1.003;    // 0.3% target
  const tp2 = price * 1.006;    // 0.6% stretch
  const rr = ((tp1 - price) / (price - sl)).toFixed(2);

  const trend = price > levels.support ? 'BULLISH' : 'BEARISH';
  const strength = Math.abs(price - levels.support) / price < 0.002 ? 'STRONG' : 'WEAK';

  return {
    action: trend === 'BULLISH' ? 'BUY' : 'SELL',
    entry: price.toFixed(0),
    stopLoss: sl.toFixed(0),
    target1: tp1.toFixed(0),
    target2: tp2.toFixed(0),
    riskReward: `1:${rr}`,
    confidence: strength === 'STRONG' ? 92 : 78,
    strategy: "Iron Fortress Scalp (0.3% move in 5-15 min)",
    validFor: "Next 15 minutes",
    note: "Enter only if volume spike + candle close above support"
  };
}

module.exports = { getScalpSignal };

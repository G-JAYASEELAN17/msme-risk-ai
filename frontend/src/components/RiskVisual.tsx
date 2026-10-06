import { Sparkles, TrendingUp } from "lucide-react";

export default function RiskVisual() {
  return (
    <div className="risk-visual">
      <div className="glow glow-one" />
      <div className="glow glow-two" />

      <div className="risk-card main-risk">
        <div className="card-label">
          Current assessment
          <span className="live-dot">Live model</span>
        </div>

        <div className="score-row">
          <div className="score-ring">
            <div>
              <strong>82</strong>
              <small>/100</small>
            </div>
          </div>

          <div>
            <p className="eyebrow green">LOW RISK</p>
            <h3>Healthy profile</h3>
            <p className="muted small">
              Confidence score <b>92%</b>
            </p>
          </div>
        </div>

        <div className="metric-list">
          {[
            ["Business stability", "85%", "green"],
            ["Cash flow", "82%", "blue"],
            ["Payment history", "91%", "cyan"]
          ].map(([label, value, color]) => (
            <div className="metric" key={label}>
              <div>
                <span>{label}</span>
                <b>{value}</b>
              </div>
              <div className={`metric-bar ${color}`}>
                <i style={{ width: value }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="risk-card prediction">
        <div className="prediction-icon">
          <TrendingUp size={18} />
        </div>

        <div>
          <span className="muted small">Prediction</span>
          <strong>Low default probability</strong>
          <span className="muted small">AI confidence: 92%</span>
        </div>

        <Sparkles className="sparkle" size={17} />
      </div>

      <div className="mini-chart">
        <span>Risk trend</span>
        <b>↓ 14.8%</b>
        <div className="chart-line">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { SplitFlapNumber } from "./Monitor";

/**
 * Dev-only harness used by the E2E test in e2e/splitflap.spec.ts.
 * Renders a SplitFlapNumber and exposes buttons + an input so the test
 * can drive value changes and assert the inner translateY transform updates.
 */
const SplitFlapHarness = () => {
  const [value, setValue] = useState(0);
  return (
    <div style={{ background: "#111", color: "#fff", minHeight: "100vh", padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>SplitFlap Harness</h1>
      <div data-testid="flap-wrap" style={{ marginBottom: 24 }}>
        <SplitFlapNumber value={value} size={64} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button data-testid="inc" onClick={() => setValue((v) => v + 1)}>+1</button>
        <button data-testid="add10" onClick={() => setValue((v) => v + 10)}>+10</button>
        <button data-testid="add100" onClick={() => setValue((v) => v + 100)}>+100</button>
        <button data-testid="rand" onClick={() => setValue(Math.floor(Math.random() * 1000))}>
          random
        </button>
        <button data-testid="reset" onClick={() => setValue(0)}>reset</button>
        <input
          data-testid="set-input"
          type="number"
          defaultValue={0}
          onChange={(e) => setValue(Number(e.target.value) || 0)}
          style={{ color: "#000", padding: 4 }}
        />
      </div>
      <p data-testid="current-value" style={{ marginTop: 16 }}>value={value}</p>
    </div>
  );
};

export default SplitFlapHarness;

"use client";

import { useEffect, useRef, useState } from "react";

type Metric = {
  name: string;
  duration: number;
  timestamp: number;
};

export function PerfMonitor() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [visible, setVisible] = useState(false);
  const [fps, setFps] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const frameRef = useRef<number>(0);

  // Increment render counter and flash indicator
  useEffect(() => {
    setRenderCount((c) => c + 1);
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 300);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    let frames = 0;
    let last = performance.now();

    function loop(now: number) {
      frames++;
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      frameRef.current = requestAnimationFrame(loop);
    }
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  useEffect(() => {
    if (typeof performance === "undefined" || !performance.getEntriesByType) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const next: Metric[] = entries
        .filter((e) => e.duration > 1)
        .slice(0, 8)
        .map((e) => ({
          name: e.name.slice(0, 40),
          duration: Math.round(e.duration),
          timestamp: Date.now(),
        }));
      if (next.length) {
        setMetrics((prev) => [...next, ...prev].slice(0, 12));
      }
    });

    try {
      observer.observe({ entryTypes: ["measure", "longtask"] as string[] });
    } catch {
      // longtask may not be supported
    }

    return () => observer.disconnect();
  }, []);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 50,
          padding: "6px 10px",
          background: flash ? "#f59e0b" : "#0f172a",
          color: "white",
          border: 0,
          borderRadius: 8,
          fontSize: 12,
          cursor: "pointer",
          transition: "background 0.15s",
        }}
      >
        Perf {fps} fps · R{renderCount}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 50,
        width: 280,
        background: "#0f172a",
        color: "#e2e8f0",
        borderRadius: 10,
        padding: 12,
        fontSize: 12,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        boxShadow: "0 8px 24px rgba(0,0,0,.3)",
        border: flash ? "1px solid #f59e0b" : "1px solid transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Performance</strong>
        <button onClick={() => setVisible(false)} style={{ background: "none", border: 0, color: "#94a3b8", cursor: "pointer" }}>
          ✕
        </button>
      </div>
      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <span>
          FPS: <span style={{ color: fps >= 50 ? "#4ade80" : fps >= 30 ? "#facc15" : "#f87171" }}>{fps}</span>
        </span>
        <span style={{ color: flash ? "#f59e0b" : "#94a3b8" }}>Renders: {renderCount}</span>
      </div>
      <div style={{ maxHeight: 160, overflow: "auto" }}>
        {metrics.length === 0 && <div style={{ color: "#64748b" }}>Belum ada long task</div>}
        {metrics.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #1e293b" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{m.name}</span>
            <span style={{ color: m.duration > 50 ? "#f87171" : "#94a3b8" }}>{m.duration}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}

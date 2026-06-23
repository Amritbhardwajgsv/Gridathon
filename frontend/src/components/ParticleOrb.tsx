"use client";

import { useEffect, useRef } from "react";

interface OrbParticle {
  progress: number;
  r: number;
  opacity: number;
}

interface CloudParticle {
  ox: number;
  oy: number;
  r: number;
  baseOpacity: number;
  phase: number;
  phaseSpeed: number;
  color: [number, number, number];
}

export default function ParticleOrb({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas || !ctx) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();

    const cw = () => canvas.clientWidth;
    const ch = () => canvas.clientHeight;

    // ── Cloud particles (tight cluster around centre)
    const CLOUD_COUNT = 180;
    const cloud: CloudParticle[] = Array.from({ length: CLOUD_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.6) * 90;
      const isPink = Math.random() < 0.7;
      return {
        ox: Math.cos(angle) * dist,
        oy: Math.sin(angle) * dist * 0.75,
        r: Math.random() * 2.2 + 0.4,
        baseOpacity: Math.random() * 0.7 + 0.25,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: Math.random() * 0.04 + 0.01,
        color: isPink
          ? [255, 140 + Math.random() * 100, 140 + Math.random() * 80]
          : [255, 255, 255],
      };
    });

    // ── Orbit ring particles
    const ORBIT_COUNT = 70;

    const orbit1: OrbParticle[] = Array.from({ length: ORBIT_COUNT }, (_, i) => ({
      progress: i / ORBIT_COUNT + Math.random() * 0.005,
      r: Math.random() * 1.4 + 0.4,
      opacity: Math.random() * 0.6 + 0.35,
    }));

    const orbit2: OrbParticle[] = Array.from({ length: ORBIT_COUNT }, (_, i) => ({
      progress: i / ORBIT_COUNT + Math.random() * 0.005,
      r: Math.random() * 1.4 + 0.4,
      opacity: Math.random() * 0.6 + 0.3,
    }));

    const TILT1 =  0.28;  // radians
    const TILT2 = -0.22;
    const SPEED1 = 0.0012;
    const SPEED2 = 0.0009;

    function orbPos(
      progress: number,
      rx: number,
      ry: number,
      tilt: number,
      cx: number,
      cy: number
    ) {
      const a = progress * Math.PI * 2;
      const ox = Math.cos(a) * rx;
      const oy = Math.sin(a) * ry;
      return {
        x: cx + ox * Math.cos(tilt) - oy * Math.sin(tilt),
        y: cy + ox * Math.sin(tilt) + oy * Math.cos(tilt),
      };
    }

    let t = 0;
    let raf: number;

    function draw() {
      const W = cw();
      const H = ch();
      const cx = W / 2;
      const cy = H / 2;
      const minDim = Math.min(W, H);

      ctx.clearRect(0, 0, W, H);

      // ── Central glow
      const pulse = 1 + Math.sin(t * 1.8) * 0.12;
      const glows = [
        { r: minDim * 0.38 * pulse, a: 0.025 },
        { r: minDim * 0.24 * pulse, a: 0.06 },
        { r: minDim * 0.14 * pulse, a: 0.16 },
        { r: minDim * 0.07 * pulse, a: 0.42 },
        { r: minDim * 0.03 * pulse, a: 0.90 },
      ];
      glows.forEach(({ r, a }) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,220,220,${a})`);
        g.addColorStop(1, "rgba(255,180,180,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Cloud
      cloud.forEach((p) => {
        const tw = Math.sin(t * p.phaseSpeed * 60 + p.phase) * 0.28 + 0.72;
        const alpha = p.baseOpacity * tw;
        const [r, g, b] = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(cx + p.ox, cy + p.oy, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // ── Orbit 1
      const rx1 = minDim * 0.40;
      const ry1 = rx1 * 0.30;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(TILT1);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx1, ry1, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(180,140,255,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      orbit1.forEach((p) => {
        p.progress = (p.progress + SPEED1) % 1;
        const { x, y } = orbPos(p.progress, rx1, ry1, TILT1, cx, cy);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = "rgba(190,155,255,1)";
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // ── Orbit 2
      const rx2 = minDim * 0.44;
      const ry2 = rx2 * 0.26;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(TILT2);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx2, ry2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(180,140,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      orbit2.forEach((p) => {
        p.progress = (p.progress + SPEED2) % 1;
        const { x, y } = orbPos(p.progress, rx2, ry2, TILT2, cx, cy);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = "rgba(160,120,255,1)";
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      t += 0.016;
      raf = requestAnimationFrame(draw);
    }

    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}

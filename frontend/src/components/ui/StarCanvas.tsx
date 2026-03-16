"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  speed: number;
  phase: number;
  color: string;
}

interface Shooter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  alpha: number;
}

const STAR_COLORS = ["#ffffff", "#a8c8ff", "#c8aaff", "#aafff5"];

export default function StarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootersRef = useRef<Shooter[]>([]);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const fpsInterval = isMobile ? 1000 / 24 : 0;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    }

    function initStars() {
      if (!canvas) return;
      const count = Math.floor((canvas.width * canvas.height) / 6000);
      const arr: Star[] = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.4 + 0.2,
          alpha: Math.random() * 0.6 + 0.1,
          speed: Math.random() * 0.015 + 0.005,
          phase: Math.random() * Math.PI * 2,
          color: STAR_COLORS[Math.floor(Math.random() * 4)],
        });
      }
      starsRef.current = arr;
    }

    function spawnShooter() {
      if (!canvas) return;
      shootersRef.current.push({
        x: Math.random() * canvas.width * 0.7,
        y: Math.random() * canvas.height * 0.5,
        vx: Math.random() * 5 + 4,
        vy: Math.random() * 2 + 1,
        len: Math.random() * 120 + 60,
        alpha: 1,
      });
    }

    const shooterInterval = setInterval(spawnShooter, 3500);

    function draw(timestamp: number) {
      if (!canvas || !ctx) return;

      if (fpsInterval && timestamp - lastFrameRef.current < fpsInterval) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameRef.current = timestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tRef.current += 0.012;
      const t = tRef.current;

      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const a = s.alpha * (0.6 + 0.4 * Math.sin(t * s.speed * 60 + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = a;
        ctx.fill();
      }

      // Shooting stars
      shootersRef.current = shootersRef.current.filter((s) => s.alpha > 0.01);
      for (const s of shootersRef.current) {
        ctx.globalAlpha = s.alpha * 0.8;
        const grad = ctx.createLinearGradient(
          s.x,
          s.y,
          s.x - s.len,
          s.y - s.len * 0.4
        );
        grad.addColorStop(0, "rgba(180,220,255,0.9)");
        grad.addColorStop(1, "rgba(180,220,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.len, s.y - s.len * 0.4);
        ctx.stroke();
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= 0.022;
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      clearInterval(shooterInterval);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none light:opacity-35 max-[600px]:opacity-50"
      aria-hidden="true"
    />
  );
}

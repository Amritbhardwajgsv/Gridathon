"use client";
import { useEffect } from "react";

export default function ScrollAnimationsProvider() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll("main > section"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.setAttribute("data-visible", "");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    sections.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 40) {
        el.setAttribute("data-visible", "");
      } else {
        el.setAttribute("data-reveal", "");
        observer.observe(el);
      }
    });

    // Stagger children inside grid wrappers
    document.querySelectorAll("[data-stagger]").forEach((grid) => {
      Array.from(grid.children).forEach((child, i) => {
        const rect = (child as HTMLElement).getBoundingClientRect();
        if (rect.top >= window.innerHeight) {
          child.setAttribute("data-reveal", "");
          child.setAttribute("data-reveal-delay", String(Math.min(i + 1, 4)));
          observer.observe(child);
        }
      });
    });

    // Count-up animation for [data-count-target] elements
    function animateCount(el: Element) {
      const raw = el.getAttribute("data-count-target") ?? "0";
      const target = parseFloat(raw);
      const suffix = el.getAttribute("data-count-suffix") ?? "";
      const duration = 1400;
      const start = performance.now();
      const isInt = Number.isInteger(target);

      function step(now: number) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
        const current = eased * target;
        el.textContent = (isInt ? Math.floor(current) : current.toFixed(1)) + suffix;
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    const countEls = document.querySelectorAll("[data-count-target]");
    if (countEls.length > 0) {
      const countObs = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            animateCount(e.target);
            countObs.unobserve(e.target);
          }
        });
      }, { threshold: 0.5 });

      countEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          animateCount(el);
        } else {
          countObs.observe(el);
        }
      });
    }

    return () => observer.disconnect();
  }, []);

  return null;
}

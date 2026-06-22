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
        // already in view on mount — reveal immediately, no flash
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

    return () => observer.disconnect();
  }, []);

  return null;
}

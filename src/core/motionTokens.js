import { animate } from 'motion';

export const DURATION = {
  instant: 0.14,
  fast: 0.2,
  base: 0.3,
  enter: 0.44
};

export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.4, 0, 0.2, 1]
};

export function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function safeAnimate(target, keyframes, options = {}) {
  if (!target) return { finished: Promise.resolve() };
  if (prefersReducedMotion()) {
    return animate(target, keyframes, { ...options, duration: 0.01, delay: 0 });
  }
  return animate(target, keyframes, {
    duration: DURATION.fast,
    easing: EASE.out,
    ...options
  });
}

/**
 * Animates a pill/tab indicator using ONLY transform (translateX + scaleX) to avoid layout reflow.
 */
export function animateThumb(thumbEl, targetEl, containerEl, insetPx = 0) {
  if (!thumbEl || !targetEl || !containerEl) return;

  const containerRect = containerEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const x = targetRect.left - containerRect.left - insetPx;
  const scaleX = targetRect.width / 100;

  return safeAnimate(
    thumbEl,
    {
      opacity: 1,
      transform: `translateX(${x}px) scaleX(${scaleX})`
    },
    { duration: DURATION.fast, easing: EASE.out }
  );
}
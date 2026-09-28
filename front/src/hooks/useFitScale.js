import { useLayoutEffect, useRef } from "react";

const MIN_SCALE = 0.62;
const STEP = 0.04;

/**
 * Shrinks a container's --fit-scale until its content fits its own height,
 * instead of letting it overflow into a scrollbar. Re-measures on resize and
 * whenever `deps` change (new question, new options, hint revealed, etc).
 */
export default function useFitScale(deps = []) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let frame = 0;
    const measure = () => {
      node.style.setProperty("--fit-scale", 1);
      let scale = 1;
      // Overflow is measured across a couple of frames because option text
      // reflows as the scale itself changes line count.
      for (let i = 0; i < 12 && node.scrollHeight > node.clientHeight + 1 && scale > MIN_SCALE; i += 1) {
        scale = Math.max(MIN_SCALE, scale - STEP);
        node.style.setProperty("--fit-scale", scale);
      }
    };

    frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    });
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

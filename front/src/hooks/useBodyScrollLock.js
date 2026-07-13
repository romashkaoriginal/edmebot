import { useEffect } from "react";

let activeLocks = 0;
let scrollPosition = 0;
let bodyStyles = null;
let htmlStyles = null;

function lockPage() {
  if (activeLocks++ > 0) return;

  const body = document.body;
  const html = document.documentElement;
  scrollPosition = window.scrollY;
  bodyStyles = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    touchAction: body.style.touchAction,
  };
  htmlStyles = {
    overflow: html.style.overflow,
    overscrollBehavior: html.style.overscrollBehavior,
  };

  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollPosition}px`;
  body.style.width = "100%";
  body.style.touchAction = "none";
  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
}

function unlockPage() {
  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks > 0 || !bodyStyles || !htmlStyles) return;

  Object.assign(document.body.style, bodyStyles);
  Object.assign(document.documentElement.style, htmlStyles);
  window.scrollTo(0, scrollPosition);
  bodyStyles = null;
  htmlStyles = null;
}

/** Locks both body and html scrolling, including iOS/Telegram touch scrolling. */
export default function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lockPage();
    return unlockPage;
  }, [active]);
}

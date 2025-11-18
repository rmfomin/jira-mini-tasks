import { GADGET_ID, INIT_POLL_MS, INIT_POLL_MAX_TRIES } from '../constants.js';

/**
 * Поиск целевого гаджета на дашборде с опросом
 */
export function pollForGadget(onFound) {
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const gadgetEl = document.getElementById(GADGET_ID);
    if (gadgetEl) {
      clearInterval(timer);
      onFound(gadgetEl);
    } else if (tries >= INIT_POLL_MAX_TRIES) {
      clearInterval(timer);
    }
  }, INIT_POLL_MS);

  return () => clearInterval(timer);
}


// SCORM 1.2 launch lifecycle. Only initialize and finish the session.
(() => {
  function findApi(start) {
    let frame = start;
    for (let i = 0; frame && i < 24; i++) {
      try {
        if (frame.API && typeof frame.API.LMSInitialize === "function")
          return frame.API;
        if (frame.parent === frame) break;
        frame = frame.parent;
      } catch {
        break;
      }
    }
  }
  const api = findApi(window) || findApi(window.opener);
  if (!api) return;
  try {
    if (String(api.LMSInitialize("")) !== "true") return;
    window.addEventListener(
      "pagehide",
      () => {
        try {
          api.LMSFinish("");
        } catch {}
      },
      { once: true },
    );
  } catch {
    /* The atlas also runs independently of an LMS. */
  }
})();

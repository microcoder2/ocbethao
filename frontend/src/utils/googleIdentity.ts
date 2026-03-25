let googleScriptPromise: Promise<NonNullable<Window["google"]>> | null = null;

function resolveGoogle(): NonNullable<Window["google"]> | null {
  if (typeof window === "undefined" || !window.google?.accounts?.id) {
    return null;
  }
  return window.google;
}

export function loadGoogleIdentityScript(): Promise<NonNullable<Window["google"]>> {
  const existingGoogle = resolveGoogle();
  if (existingGoogle) {
    return Promise.resolve(existingGoogle);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-identity="true"]'
    );

    const handleLoad = () => {
      const google = resolveGoogle();
      if (google) {
        resolve(google);
        return;
      }
      reject(new Error("Google Identity script loaded but API is unavailable"));
    };

    const handleError = () => {
      googleScriptPromise = null;
      reject(new Error("Failed to load Google Identity script"));
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client?hl=vi";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

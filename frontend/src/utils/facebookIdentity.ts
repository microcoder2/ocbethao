let facebookScriptPromise: Promise<NonNullable<Window["FB"]>> | null = null;
let initializedFacebookAppKey = "";

function resolveFacebook(): NonNullable<Window["FB"]> | null {
  if (typeof window === "undefined" || !window.FB?.login) {
    return null;
  }
  return window.FB;
}

export async function loadFacebookSdk(config: {
  appId: string;
  version?: string;
}): Promise<NonNullable<Window["FB"]>> {
  const appId = String(config.appId || "").trim();
  const version = String(config.version || "v22.0").trim() || "v22.0";

  if (!appId) {
    throw new Error("Facebook App ID is required");
  }

  if (!facebookScriptPromise) {
    facebookScriptPromise = new Promise((resolve, reject) => {
      const existingFacebook = resolveFacebook();
      if (existingFacebook) {
        resolve(existingFacebook);
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-facebook-sdk="true"]'
      );

      const previousInit = window.fbAsyncInit;
      window.fbAsyncInit = () => {
        previousInit?.();
        const facebook = resolveFacebook();
        if (facebook) {
          resolve(facebook);
          return;
        }
        facebookScriptPromise = null;
        reject(new Error("Facebook SDK loaded but API is unavailable"));
      };

      const handleError = () => {
        facebookScriptPromise = null;
        reject(new Error("Failed to load Facebook SDK"));
      };

      if (existingScript) {
        existingScript.addEventListener("error", handleError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.dataset.facebookSdk = "true";
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
    });
  }

  const facebook = await facebookScriptPromise;
  const appKey = `${appId}:${version}`;
  if (initializedFacebookAppKey !== appKey) {
    facebook.init({
      appId,
      cookie: true,
      xfbml: false,
      version,
    });
    initializedFacebookAppKey = appKey;
  }

  return facebook;
}

export async function loginWithFacebook(config: {
  appId: string;
  version?: string;
  scope?: string;
}): Promise<FacebookAuthResponse> {
  const facebook = await loadFacebookSdk(config);
  const scope = String(config.scope || "public_profile,email").trim() || "public_profile,email";

  return new Promise((resolve, reject) => {
    facebook.login(
      (response) => {
        if (response?.authResponse?.accessToken) {
          resolve(response.authResponse);
          return;
        }
        reject(new Error("Facebook login was cancelled or denied"));
      },
      {
        scope,
        return_scopes: true,
      }
    );
  });
}

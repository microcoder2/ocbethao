/// <reference types="vite/client" />

type GoogleCredentialResponse = {
  credential: string;
  select_by?: string;
  state?: string;
};

type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
  ux_mode?: "popup" | "redirect";
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: "signin" | "signup" | "use";
};

type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: string | number;
};

type FacebookAuthResponse = {
  accessToken: string;
  userID: string;
  expiresIn: number;
  signedRequest?: string;
  grantedScopes?: string;
  reauthorize_required_in?: number;
};

type FacebookStatusResponse = {
  status: "connected" | "not_authorized" | "unknown";
  authResponse?: FacebookAuthResponse;
};

type FacebookInitConfiguration = {
  appId: string;
  cookie?: boolean;
  xfbml?: boolean;
  version: string;
};

type FacebookLoginOptions = {
  scope?: string;
  return_scopes?: boolean;
  auth_type?: string;
};

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (options: FacebookInitConfiguration) => void;
      login: (
        callback: (response: FacebookStatusResponse) => void,
        options?: FacebookLoginOptions
      ) => void;
      logout?: (callback?: () => void) => void;
      getLoginStatus?: (callback: (response: FacebookStatusResponse) => void) => void;
    };
    google?: {
      accounts: {
        id: {
          initialize: (options: GoogleIdConfiguration) => void;
          renderButton: (
            parent: HTMLElement,
            options: GoogleButtonConfiguration
          ) => void;
          prompt?: () => void;
          cancel?: () => void;
          disableAutoSelect?: () => void;
        };
      };
    };
  }
}

export {};

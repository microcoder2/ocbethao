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

declare global {
  interface Window {
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

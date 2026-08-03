/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace JSX {
  interface IntrinsicElements {
    "adsgram-task": import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLElement>, HTMLElement> & {
      "data-block-id"?: string;
      "data-debug"?: string | boolean;
      "data-debug-console"?: string | boolean;
    };
  }
}

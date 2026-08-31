/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WIDGET_FIXTURE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

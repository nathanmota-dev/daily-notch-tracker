# DailyNotch Linux

Aplicativo Linux local-first para tarefas e foco, construído com React, Vite,
TypeScript, Tailwind CSS, Vitest, Tauri 2 e Rust.

## Requisitos

- Node.js 20.19+ (o ambiente atual usa Node 24)
- npm
- Rust e Cargo
- Dependências de sistema do Tauri/WebKitGTK no Ubuntu

No Ubuntu, instale as dependências antes do primeiro build desktop:

```bash
sudo apt update
sudo apt install \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libdbus-1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Consulte também a documentação oficial de [pré-requisitos do Tauri](https://v2.tauri.app/start/prerequisites/).

## Desenvolvimento

Instale as dependências JavaScript:

```bash
npm install
```

Para executar apenas a UI React no navegador:

```bash
npm run dev
```

Para executar o app desktop com Tauri e Rust:

```bash
npm run tauri:dev
```

O comando `tauri:dev` inicia o Vite automaticamente e abre a janela desktop.
O shell seleciona automaticamente o `desktopApi` real no webview Tauri. Até os
comandos de domínio serem implementados no Rust, a ausência de `get_snapshot`
é apresentada como um erro recuperável. O comando temporário `greet` continua
coberto pelo teste Rust da ponte.

Ao executar somente a UI no navegador, o shell usa um snapshot mockado,
determinístico e sem persistência. Testes e futuras superfícies podem criar
outros snapshots ou falhas com `createMockDesktopApi`.

Para executar o teste E2E da interface no navegador, instale o navegador do
Playwright uma vez e rode:

```bash
npx playwright install chromium
npm run test:e2e
```

O teste sobe o servidor Vite automaticamente e valida o shell com o snapshot
mockado do navegador.

## Contrato desktop

O entrypoint `src/lib/desktopApi.ts` expõe os tipos compartilhados, os comandos
camelCase e as assinaturas tipadas dos eventos do MVP. O transport Tauri traduz
essa API para os nomes snake_case dos comandos Rust; o transport mock permite
injetar snapshots, respostas, falhas e eventos sem depender do webview.

Componentes React não devem importar `invoke` ou `listen` diretamente. O ESLint
protege essa fronteira para que payloads e erros sejam normalizados em um único
lugar.

## Verificações

```bash
npm run build
npm test
npm run test:e2e
npm run test:rust
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

`npm test` executa os testes do frontend com Vitest. `npm run test:rust` é um
atalho para o `cargo test` do projeto Tauri. Os comandos Rust dependem das
bibliotecas Linux listadas acima. O `cargo fmt` também pode ser usado quando o
componente `rustfmt` estiver instalado.

## Estrutura

```text
.
├── src/                  # React, TypeScript, Vite e Tailwind
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── pages/
│   ├── styles/
│   └── lib/
│       ├── desktop/      # Contratos e transports Tauri/mock
│       └── desktopApi.ts # API pública do frontend
├── src-tauri/            # Rust e integração com Linux
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   ├── services/
│   │   └── state/
│   ├── capabilities/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

O bundle está temporariamente desativado no scaffold inicial. O ícone Linux
base já está em `src-tauri/icons/icon.png`; AppImage e `.deb` entram na etapa
de release.

## Licença

MIT — veja [`LICENSE`](LICENSE).

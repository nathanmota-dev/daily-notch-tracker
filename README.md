# DailyNotch Linux

Aplicativo Linux local-first para tarefas e foco, construído com React, Vite,
TypeScript, Tailwind CSS, Vitest, Tauri 2 e Rust.

## Requisitos

- Node.js 20.19+
- npm
- Rust e Cargo
- Ubuntu 22.04 x64 é a baseline de build e validação deste MVP
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
  libxdo-dev \
  libssl-dev \
  libdbus-1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  pkg-config
```

Consulte também a documentação oficial de [pré-requisitos do Tauri](https://v2.tauri.app/start/prerequisites/).

## Desenvolvimento

Instale as dependências JavaScript:

```bash
npm ci
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
O shell seleciona automaticamente o `desktopApi` real no webview Tauri. Tarefas,
sessões e settings do desktop são persistidos pelo backend Rust em
`app_data_dir()/dailynotch.json`, usando o diretório retornado pela API de paths
do Tauri, sem um caminho de usuário hardcoded. O foco e o status de atalhos são
estado de runtime e um foco em andamento volta ao estado idle ao iniciar o app;
as sessões concluídas ou interrompidas e o `focusedSeconds` permanecem
persistidos.

## Verificações

```bash
npm ci
npm run build
npm test
npm run test:coverage:ci
npm run lint -- --max-warnings=0
npm run typecheck
npm run test:rust
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings
node scripts/quality-gate.js
npm run benchmark:ci
npm run benchmark:rust
node scripts/benchmark-gate.js
```

`npm test` executa os testes do frontend com Vitest. `npm run test:rust` é um
atalho para o `cargo test` do projeto Tauri. Os comandos Rust dependem das
bibliotecas Linux listadas acima. O fluxo de qualidade também verifica cobertura,
lint, typecheck, clippy, o quality gate e os benchmarks sem alterar suas regras.

## Documentação

- [Visão geral](docs/general-overview.md): comportamento atual do desktop,
  contrato, superfícies, preview e distribuição.
- [PRD técnico](docs/PRD-TAURI.md): escopo funcional e decisões técnicas.
- [Plano de implementação](docs/PRD.md): roadmap do MVP e critérios de aceite.
- [Dimensões das janelas](docs/window-dimensions.md): contrato de layout e
  posicionamento.
- [Quality and performance gates](scripts/README.md): métricas e benchmarks do
  CI.

## Estrutura

```text
.
├── docs/                 # Documentação geral, PRDs e contratos
├── scripts/              # Quality gate e microbenchmarks
├── src/                  # React, TypeScript, Vite e Tailwind
│   ├── app/
│   ├── components/
│   │   └── ui/
│   ├── features/
│   │   ├── settings/
│   │   └── tasks/
│   ├── icons/
│   ├── lib/
│   │   ├── desktop/      # Contratos e transports Tauri/mock
│   │   └── desktopApi.ts # API pública do frontend
│   └── styles/
├── src-tauri/            # Rust e integração com Linux
│   ├── benches/
│   ├── capabilities/
│   ├── icons/
│   ├── src/
│   │   ├── commands/
│   │   ├── domain/
│   │   ├── services/
│   │   ├── state/
│   │   └── storage/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

Os ícones Linux do bundle ficam em `src-tauri/icons/` nos tamanhos
`32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png` e `icon.png`.

## Licença

MIT — veja [`LICENSE`](LICENSE).

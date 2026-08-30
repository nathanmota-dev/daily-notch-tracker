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
A tela inicial possui um botão que verifica a ponte de comunicação com o
comando Rust `greet`.

Para executar o teste E2E da interface no navegador, instale o navegador do
Playwright uma vez e rode:

```bash
npx playwright install chromium
npm run test:e2e
```

O teste sobe o servidor Vite automaticamente, valida a tela inicial e verifica
que a interface informa corretamente quando é executada fora do runtime Tauri.

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

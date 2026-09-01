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
O shell seleciona automaticamente o `desktopApi` real no webview Tauri. Tarefas,
sessões e settings do desktop são persistidos pelo backend Rust em
`app_data_dir()/dailynotch.json`, usando o diretório retornado pela API de paths
do Tauri, sem um caminho de usuário hardcoded. O foco e o status de atalhos são
estado de runtime e voltam aos defaults ao iniciar o app.

Se o arquivo ainda não existir, o diretório é criado e o app começa com um
payload vazio. JSON inválido ou um `schema_version` desconhecido inicia um
estado vazio recuperável, preserva o arquivo original e registra um diagnóstico
interno. Antes da primeira gravação desse estado recuperado, o backend cria
`dailynotch.json.recovery-<uuid>.bak` no mesmo diretório. Ainda não há tela ou
comando de diagnostics; a exposição desse diagnóstico fica para uma issue
futura. O comando temporário `greet` continua coberto pelo teste Rust do
scaffold, mas não é registrado na aplicação.

Ao executar somente a UI no navegador, o shell usa um snapshot mockado,
determinístico e sem persistência; esse mock não lê nem escreve o arquivo do
desktop. Testes e futuras superfícies podem criar outros snapshots ou falhas com
`createMockDesktopApi`.

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

## Superfícies

O bundle compartilhado seleciona a superfície pelo label da janela Tauri:
`overlay`, `tasks` ou `settings`. No navegador, a mesma seleção pode ser
testada com `?surface=overlay`, `?surface=tasks` ou `?surface=settings`; sem o
parâmetro, o shell usa `overlay`.

### Posicionamento do overlay

No desktop, o overlay é centralizado no monitor primário e posicionado 6 px
abaixo do início da `workArea`, usando coordenadas físicas e a escala informada
pelo Tauri. Quando o compositor não fornece uma `workArea` válida, o cálculo
usa o topo do monitor, uma altura estimada de painel de 32 px e a mesma margem
de 6 px. Mudanças de escala, resolução, conexão ou monitor primário são
detectadas pelo evento de escala e por uma consulta periódica.

Wayland e alguns compositores podem atrasar ou rejeitar a alteração de posição
de uma janela sempre no topo, ou não expor métricas completas durante uma
reconfiguração. Nesses casos, o app mantém a posição atual e continua
funcionando; use a tray do overlay ou a superfície `Tasks` como fallback para
acessar as tarefas.

Durante o desenvolvimento, o widget pode ser renderizado com uma fixture pelo
parâmetro `?fixture=`. As opções recolhidas são `running`, `paused`, `no-task`,
`long-title`, `minimal`, `timeline-off` e `rgb`. O dashboard expandido usa
`expanded`, `expanded-empty`, `expanded-one`, `expanded-overflow`,
`expanded-completed` e `expanded-long-title`; por exemplo:

```text
http://localhost:5173/?surface=overlay&fixture=running
http://localhost:5173/?surface=overlay&fixture=expanded
http://localhost:5173/?surface=overlay&fixture=expanded-overflow
```

Para visualizar a mesma fixture no webview Tauri enquanto a UI final ainda está
em construção, use `VITE_WIDGET_FIXTURE=running npm run tauri:dev`. Esse
override é habilitado apenas no modo de desenvolvimento.

Os MVPs-006 e 007 reproduzem a apresentação estática do dashboard com
snapshots e atividade mockados. O dashboard exibe um heatmap mensal
Monday-first, limitado ao dia atual e sem dados de sessões reais. Hover real,
resize da janela Tauri e drag-and-drop funcional ficam para etapas posteriores.
A janela completa `Tasks` também permanece como placeholder até uma issue
futura; o botão `Open Tasks` desta fixture apenas expõe o callback de
apresentação.

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
│   │   ├── state/
│   │   └── storage/
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

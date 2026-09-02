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
estado de runtime e um foco em andamento volta ao estado idle ao iniciar o app;
as sessões concluídas ou interrompidas e o `focusedSeconds` permanecem
persistidos.

Se o arquivo ainda não existir, o diretório é criado e o app começa com um
payload vazio. JSON inválido ou um `schema_version` desconhecido inicia um
estado vazio recuperável, preserva o arquivo original e registra um diagnóstico
interno. Antes da primeira gravação desse estado recuperado, o backend cria
`dailynotch.json.recovery-<uuid>.bak` no mesmo diretório. O comando
`get_app_diagnostics` expõe somente a versão, o caminho real do arquivo e o
estado resumido das integrações; títulos, notas e erros brutos de persistência
não atravessam o IPC. Atalhos globais e autostart permanecem `unavailable` até
que os plugins correspondentes sejam adicionados. O comando temporário `greet`
continua coberto pelo teste Rust do scaffold, mas não é registrado na aplicação.

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

Cada mutação bem-sucedida retorna e emite um `AppSnapshot` completo com uma
`revision` monotônica. Tarefas emitem `store-changed`, settings emitem
`store-changed` e `settings-changed`, e as transições mínimas de foco emitem
`focus-changed`. Todas as superfícies assinam esses eventos e
`shortcut-changed`; revisões duplicadas ou atrasadas são ignoradas. O evento
`window-placement-changed` já faz parte do contrato para a integração futura.

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
funcionando. A visibilidade nativa também depende do compositor: snapshots
`idle` ocultam a janela e estados `running`/`paused` a mostram novamente; use a
tray do overlay ou a superfície `Tasks` como fallback se o compositor não
respeitar uma dessas operações.

### Interação do overlay

O overlay expande imediatamente quando o ponteiro entra na superfície e começa
a recolher 400 ms depois que o ponteiro sai. Uma nova entrada cancela o
recolhimento pendente, e apenas um timer pode ficar ativo por vez. Menus e
popovers futuros podem manter o overlay expandido com o contrato reutilizável
`useOverlayHold(isHeld)`; esta etapa fornece a infraestrutura, mas não cria um
popover visual.

No navegador, a janela nativa não existe: o widget recolhido em estado `idle`
continua usando `hidden` como fallback visual e de acessibilidade. Em Tauri, a
janela permanece `visible` na configuração inicial para permitir o primeiro
snapshot e passa a ser ocultada ou mostrada pelo estado de foco.

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

Os MVPs-006 e 007 reproduzem a apresentação do dashboard com snapshots e
atividade mockados. A partir do MVP-015, o dashboard expandido seleciona do
`AppSnapshot` apenas as tarefas agendadas para o dia local, e suas ações de
conclusão, foco e reorder enviam mutações reais pelo `desktopApi`; a resposta
do Rust é a fonte de verdade da UI. O dashboard exibe um heatmap mensal
Monday-first, limitado ao dia atual e sem dados de sessões reais. O resize
ancorado da janela Tauri acompanha as mudanças de apresentação, e o
drag-and-drop do resumo já reordena o bucket do dia.
A janela completa `Tasks` e a janela `Settings` são abertas sob demanda por
comandos Rust, reutilizando a janela existente pelo label e trazendo-a para
frente sem criar duplicatas. `Settings` continua sendo a superfície reservada
para configurações futuras; `Tasks` já é a superfície funcional descrita
abaixo.

O focus engine é autoritativo no Rust: iniciar, pausar, retomar, parar e
alternar um bloco persistem cada transição relevante, e `endAt` é a fonte de
verdade para concluir o bloco mesmo quando o WebView atrasa, a máquina é
bloqueada ou volta de suspend. O tempo é acumulado somente nos intervalos em
que o foco está `running`; uma sessão concluída recebe `completed: true`, uma
interrompida recebe `completed: false`, e o tempo de uma execução atrasada é
limitado ao seu deadline. O scheduler cancelável mantém no máximo um callback
vigente por vez, e tokens de geração descartam callbacks obsoletos.

Na janela `Tasks`, o CRUD é persistido pelo Rust: a lista separa os buckets
`Day` e `Unscheduled`, permite escolher a data, mantém pendentes antes de
concluídas e envia a permutação completa do bucket ao reordenar pelo handle.
O formulário também permite editar título, notas, duração, data e conclusão,
além de iniciar, pausar e retomar o foco da tarefa selecionada. Os intents
`list`, `add` e `task` chegam pela URL na abertura da janela e por
`tasks-window-intent` quando ela já existe; são transitórios e não entram no
arquivo persistido. Concluir a tarefa ativa finaliza sua sessão como concluída,
soma o tempo e marca a tarefa como feita na mesma mutação atômica. Excluir a
tarefa ativa finaliza a sessão como interrompida e, quando houver tempo válido,
preserva o registro como sessão standalone sem atribuí-lo à tarefa removida.

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

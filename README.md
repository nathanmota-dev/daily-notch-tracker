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

### Ciclo de vida no desktop

Ao iniciar, somente o overlay do notch é criado e fica disponível; as janelas
`Tasks` e `Settings` são abertas sob demanda. O aplicativo usa single-instance:
se um segundo launch for solicitado, esse processo é encerrado e a primeira
instância traz `Tasks` para frente quando a janela já existe; caso contrário,
traz o overlay para frente. Os argumentos e o diretório do segundo launch são
ignorados.

Fechar `Tasks` ou `Settings` apenas oculta a janela e preserva o estado, um foco
em andamento e seu scheduler para a próxima abertura. `Quit` é a saída explícita
da aplicação pelo menu nativo do tray e marca o processo como encerrando antes
de cancelar o scheduler e sair.

### Tray e menu nativo

Quando a sessão gráfica oferece suporte, o DailyNotch cria um ícone nativo com o
menu contextual: `Open Tasks`, `Start focus` ou `Stop focus`, `Settings`, o
status resumido do hotkey, `About / Update` com a versão instalada e
`Quit DailyNotch`. O item de foco acompanha imediatamente os estados `idle`,
`running` e `paused`, e usa as mesmas regras do foco acionadas pelas janelas.
`Hotkey` e `About / Update` são informativos e permanecem desabilitados; o
update checker ainda não faz parte deste MVP.

O caminho principal é abrir o menu contextual do ícone (normalmente com o
clique direito); nenhuma ação depende de clique esquerdo. Em X11, Wayland e
ambientes que oferecem AppIndicator o menu usa a integração nativa disponível.
No GNOME sem uma extensão de tray/AppIndicator, ou quando o compositor não
oferece essa integração, o diagnóstico aparece como `Unavailable` ou `Error`,
mas a aplicação continua utilizável pelas janelas `Tasks` e `Settings` e pelo
overlay quando ele estiver disponível.

Wayland e alguns compositores podem limitar transparência, posicionamento ou
`always-on-top` das janelas. Nessa situação, use `Tasks` e `Settings` como
fallback: elas são abertas sob demanda, reutilizadas pelo label e podem ser
acessadas independentemente da existência do overlay. Falhas do ícone, do
AppIndicator ou do ambiente gráfico não encerram o processo nem interrompem o
timer.

Uma instalação empacotada pode ser iniciada pelo menu do sistema ou por um
launcher, sem manter um terminal aberto. No Linux, o single-instance depende de
uma sessão D-Bus do usuário; ambientes desktop normalmente fornecem essa sessão
automaticamente, mas uma execução fora dela precisa disponibilizar
`DBUS_SESSION_BUS_ADDRESS` e um session bus funcional.

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
funcionando. O estado `idle` mantém uma área preta compacta de aproximadamente
204 x 32 px visível para que o hover e o teclado tenham um alvo estável; estados
`running` e `paused` expandem essa mesma janela para o timer recolhido.

### Interação do overlay

O overlay expande imediatamente quando o ponteiro entra na superfície e começa
a recolher 400 ms depois que o ponteiro sai. Uma nova entrada cancela o
recolhimento pendente, e apenas um timer pode ficar ativo por vez. Menus e
popovers podem manter o overlay expandido com o contrato reutilizável
`useOverlayHold(isHeld)`. O seletor de duração do foco usa esse hold para não
recolher enquanto a sessão está sendo configurada.

No navegador, a janela nativa não existe, mas a área compacta continua sendo
renderizada. Em Tauri, a janela permanece `visible` e o resize acompanha os
estados idle, recolhido e expandido.

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
Monday-first alimentado pelo histórico real de sessões: cada sessão é contada
uma vez pela data local de `startedAt`, incluindo sessões concluídas e
interrompidas, e o streak pode terminar hoje ou ontem. A grade é limitada ao
dia atual e não mostra dados futuros. O resize ancorado da janela Tauri
acompanha as mudanças de apresentação, e o drag-and-drop do resumo já reordena
o bucket do dia.
A janela completa `Tasks` e a janela `Settings` são abertas sob demanda por
comandos Rust, reutilizando a janela existente pelo label e trazendo-a para
frente sem criar duplicatas. `Settings` permite ajustar a duração padrão de
foco, alertas, timeline, RGB e modo mínimo; alterações são persistidas pelo
Rust e refletidas nas outras superfícies sem reiniciar o app. A seção de
diagnostics mostra somente a versão, o caminho do arquivo local e o estado
resumido de atalhos e autostart. Quando uma integração ainda não está
disponível, o controle fica desabilitado e a mensagem pode ser novamente
carregada; o estado salvo de preferência não é tratado como confirmação de
autostart efetivo. `Tasks` é a superfície funcional descrita abaixo.

A janela `Tasks` é criada sob demanda com tamanho inicial de 800 x 550 px,
permite redimensionamento e respeita o tamanho mínimo de 760 x 480 px. Ela é
transparente e sem decorações nativas; o cabeçalho fornece o botão de fechar.
Ao abrir, fica centralizada em relação ao dashboard e posicionada 8 px abaixo,
com ajuste à área de trabalho do monitor quando essa métrica está disponível.
Fechar a janela apenas a oculta para que o processo, o estado compartilhado e
um foco em andamento continuem ativos; ao reabrir, a mesma janela é reutilizada.
A seção estrutural `Calendar` reutiliza o seletor de data atual. A lista mantém
as tarefas visíveis durante a criação inline, mostra duração/data e oferece
ações diretas de foco, edição e exclusão. Eventos ainda não são exibidos porque
a integração ICS pertence a uma etapa posterior.

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

Iniciar o foco abre um seletor da sessão atual com minutos e segundos. A
duração aceita `00:01` até `180:00`, é usada somente nessa execução e não altera
o campo de estimativa da tarefa. `Esc`, Cancel, clique externo e os controles de
teclado fecham ou ajustam o seletor.

### Rotas do preview web

O preview do navegador usa a mesma composição de superfícies e um mock em
memória. `surface` seleciona `overlay`, `tasks` ou `settings`; `intent` aceita
`list`, `add` ou `task&taskId=<id>` na superfície Tasks; e `fixture` habilita
somente dados visuais de desenvolvimento, como `running` ou `expanded`.

Exemplos:

```text
http://localhost:5173/?surface=tasks&intent=list
http://localhost:5173/?surface=tasks&intent=add
http://localhost:5173/?surface=overlay&fixture=expanded
```

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

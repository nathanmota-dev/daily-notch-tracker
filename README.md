# DailyNotch Linux

Aplicativo Linux local-first para tarefas e foco, construído com React, Vite,
TypeScript, Tailwind CSS, Vitest, Tauri 2 e Rust.

## Requisitos

- Node.js 20.19+ (o ambiente atual usa Node 24)
- npm
- Rust e Cargo
- Ubuntu 22.04 x64 é a baseline de build e validação desta MVP
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

Ao iniciar, somente uma WebviewWindow nativa, com label `overlay`, é criada.
`Tasks`, `Settings` e o próprio Overlay são views do mesmo webview; os comandos
de navegação redimensionam essa janela e emitem o evento tipado
`surface-changed`. O aplicativo usa single-instance: se um segundo launch for
solicitado, esse processo é encerrado e a primeira instância traz a janela
`overlay` para frente. Os argumentos e o diretório do segundo launch são
ignorados.

Fechar `Tasks` ou `Settings` retorna à view `overlay`, preservando o estado, um
foco em andamento e seu scheduler. `Quit` é a saída explícita da aplicação pelo
menu nativo do tray e marca o processo como encerrando antes de cancelar o
scheduler e sair.

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
mas a aplicação continua utilizável pelas views `Tasks`, `Settings` e `Overlay`
quando a janela nativa estiver disponível.

Wayland e alguns compositores podem limitar transparência, posicionamento ou
`always-on-top` da janela. Falhas do ícone, do AppIndicator ou do ambiente
gráfico não encerram o processo nem interrompem o timer.

### Atalho global

O DailyNotch registra `Ctrl+Shift+Space` automaticamente quando a sessão
desktop permite a integração. O atalho é somente leitura neste MVP e alterna
o foco: em `idle`, inicia um bloco; em `running` ou `paused`, encerra o bloco.
Ele não é um comando de pause/resume. O botão de foco em `Tasks` e a ação de
foco do tray continuam disponíveis como fallbacks.

O diagnóstico de Settings e o item informativo do tray mostram um destes
estados:

- `registered`: o atalho foi registrado pelo processo atual.
- `unavailable`: não há uma sessão desktop gráfica disponível para tentar o
  registro.
- `error`: o registro falhou, por exemplo porque a combinação já está ocupada
  ou porque o backend da sessão não a suporta.

O registro é tentado novamente em uma nova inicialização. Falhas do atalho são
não fatais: não encerram o focus engine, não cancelam o scheduler e não
impedem o uso das views `Tasks`, `Settings` ou do tray quando essas integrações
estiverem disponíveis. O app expõe somente o estado resumido e uma mensagem
sanitizada; detalhes brutos do plugin e dados pessoais não atravessam o IPC.

No Linux, a implementação nativa depende do backend X11 (incluindo Xwayland).
Uma sessão Wayland pura, sem `DISPLAY`, aparece como `unavailable`; quando
Xwayland está disponível, o atalho pode ser registrado normalmente. WebKitGTK
e AppIndicator
também dependem do compositor e da distribuição: limitações de transparência,
posicionamento, tray ou menu não alteram o timer, e as views `Tasks` e
`Settings` continuam disponíveis na janela única.

Uma instalação empacotada pode ser iniciada pelo menu do sistema ou por um
launcher, sem manter um terminal aberto. No Linux, o single-instance depende de
uma sessão D-Bus do usuário; ambientes desktop normalmente fornecem essa sessão
automaticamente, mas uma execução fora dela precisa disponibilizar
`DBUS_SESSION_BUS_ADDRESS` e um session bus funcional.

### Autostart no Linux

O controle `Launch at login` usa o plugin oficial de autostart do Tauri. Ao
ativar, ele cria a entrada XDG `dailynotch.desktop` no diretório de autostart
do usuário (normalmente `~/.config/autostart/`); ao desativar, a entrada é
removida. O launcher recebe `--autostart`, e o processo iniciado por ele cria
somente a janela `overlay` e o tray. `Tasks` e `Settings` continuam sendo views
da mesma janela, e o single-instance evita processos duplicados.

O nome estável da entrada é `dailynotch`. Em um AppImage, o launcher usa o
caminho da imagem informado pelo runtime; em um pacote `.deb`, usa o executável
instalado. Assim, o campo `Exec` permanece apontando para o artefato correto
nos dois formatos.

O toggle mostra o estado efetivo retornado por `is_enabled`, mesmo que o campo
legado `settings.launchAtLogin` tenha outro valor. A operação de autostart não
altera esse campo, não grava o arquivo local e não emite eventos de store. Se a
sessão gráfica, o diretório XDG ou as permissões não estiverem disponíveis, o
diagnóstico informa a falha de forma sanitizada; o app manual continua podendo
usar o overlay, o tray e as janelas sob demanda.

Se o arquivo ainda não existir, o diretório é criado e o app começa com um
payload vazio. JSON inválido ou um `schema_version` desconhecido inicia um
estado vazio recuperável, preserva o arquivo original e registra um diagnóstico
interno. Antes da primeira gravação desse estado recuperado, o backend cria
`dailynotch.json.recovery-<uuid>.bak` no mesmo diretório. O comando
`get_app_diagnostics` expõe somente a versão, o caminho real do arquivo e o
estado resumido das integrações; títulos, notas e erros brutos de persistência
não atravessam o IPC. O status do atalho global é runtime-only e não é salvo no
arquivo local; o estado efetivo do autostart é consultado no backend nativo a
cada leitura de diagnostics e também não é salvo no arquivo. O comando
temporário `greet`
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

### Distribuição Linux

A MVP-030 habilita somente os targets `appimage` e `deb`. O bundler do Tauri
gera os ícones, metadados e o desktop entry do aplicativo automaticamente; não
há um template `.desktop` mantido pelo projeto. O workflow de build e
publicação pertence à MVP-031.

#### Baseline e dependências

Ubuntu 22.04 x64 é a baseline escolhida para gerar e validar os artefatos. Ela
fornece os pacotes WebKitGTK 4.1 necessários ao Tauri 2. Sistemas mais novos
podem produzir artefatos que exigem uma versão mais recente de glibc; para
suportar uma distribuição mais antiga, gere o bundle na base mais antiga que
você pretende suportar.

Além de Node.js 20.19+, npm e Rust/Cargo, instale as dependências Linux
descritas em [Pré-requisitos do Tauri](https://v2.tauri.app/start/prerequisites/):

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
  librsvg2-dev
```

O pacote `.deb` declara as dependências de runtime necessárias para WebKitGTK,
GTK e AppIndicator. O AppImage é executável sem instalação, mas ainda depende
de uma base Linux compatível e pode ser afetado por diferenças de glibc,
WebKitGTK ou compositor.

#### Build e execução

Gere os dois artefatos a partir da raiz do repositório:

```bash
npm ci
npm run tauri:build
```

Os arquivos são gravados em:

```text
src-tauri/target/release/bundle/appimage/*.AppImage
src-tauri/target/release/bundle/deb/*.deb
```

Para executar o AppImage, torne-o executável e inicie o arquivo:

```bash
chmod +x src-tauri/target/release/bundle/appimage/*.AppImage
src-tauri/target/release/bundle/appimage/*.AppImage
```

Para instalar o `.deb` e iniciar a versão empacotada pelo menu do sistema:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

O desktop entry instalado aparece como `DailyNotch Linux`. Em ambientes sem
menu gráfico, o executável instalado pode ser iniciado pelo nome `dailynotch`.
Para remover somente o pacote e preservar os dados locais, use o gerenciador
de pacotes, por exemplo:

```bash
package_name="$(dpkg-deb -f src-tauri/target/release/bundle/deb/*.deb Package)"
sudo apt remove "$package_name"
```

Remover o `.deb` não apaga silenciosamente `dailynotch.json`. O arquivo fica
fora do pacote em `app_data_dir()/dailynotch.json`; no Linux, o caminho padrão
é `~/.local/share/com.dailynotch.linux/dailynotch.json` (ou o diretório
correspondente definido por `XDG_DATA_HOME`). O caminho efetivo também aparece
em Settings > Diagnostics. Upgrade, reinstalação e troca do AppImage preservam
esse arquivo; apague-o somente como uma ação explícita de remoção dos dados do
usuário.

O controle `Launch at login` cria `~/.config/autostart/dailynotch.desktop`.
Depois de ativá-lo, verifique o `Exec` gerado: no AppImage ele aponta para o
caminho da imagem e no `.deb` para o executável instalado. O autostart inicia
somente o overlay e o tray; o single-instance evita processos duplicados.

O tray, a transparência, o posicionamento e o `always-on-top` dependem da
sessão gráfica. X11 oferece o caminho mais previsível; em Wayland puro,
Xwayland ou ambientes sem AppIndicator, o tray e o atalho global podem ficar
`Unavailable`/`Error`, e o compositor pode limitar a janela. Essas limitações
não interrompem o timer nem impedem o uso das views `Tasks` e `Settings`.

## Contrato desktop

O entrypoint `src/lib/desktopApi.ts` expõe os tipos compartilhados, os comandos
camelCase e as assinaturas tipadas dos eventos do MVP. O transport Tauri traduz
essa API para os nomes snake_case dos comandos Rust; o transport mock permite
injetar snapshots, respostas, falhas e eventos sem depender do webview.

Cada mutação bem-sucedida retorna e emite um `AppSnapshot` completo com uma
`revision` monotônica. Tarefas emitem `store-changed`, settings emitem
`store-changed` e `settings-changed`, e as transições mínimas de foco emitem
`focus-changed`. Todas as superfícies assinam esses eventos e
`shortcut-changed`; revisões duplicadas ou atrasadas são ignoradas. A troca de
view nativa usa `surface-changed`, com `surface`, `intent` e
`presentationMode`; o evento `window-placement-changed` já faz parte do
contrato para a integração futura.

Componentes React não devem importar `invoke` ou `listen` diretamente. O ESLint
protege essa fronteira para que payloads e erros sejam normalizados em um único
lugar.

## Superfícies

O bundle compartilhado renderiza `overlay`, `tasks` ou `settings` como views. No
Tauri, a única janela nativa tem label `overlay`; o backend publica
`surface-changed` para trocar a view e ajustar o tamanho. No navegador, a mesma
seleção pode ser testada com `?surface=overlay`, `?surface=tasks` ou
`?surface=settings`; sem o parâmetro, o shell usa `overlay`.

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
estados idle, recolhido e expandido. Para evitar que o tamanho natural do
WebKitGTK force uma altura de 200 px, os limites nativos mínimo e máximo são
fixados no tamanho programático atual; portanto, o resize manual do overlay
continua bloqueado.

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
A view `Tasks` usa a mesma janela nativa com tamanho de conteúdo preferido de
800 x 550 px, tamanho mínimo de 760 x 480 px e limites máximos de 800 x 550 px.
A view `Settings` compartilha esse contrato. Ambas preenchem o webview e têm
seus próprios cabeçalhos e rolagem; os comandos de abrir, fechar e voltar apenas
trocam a view e redimensionam a janela única. `Settings` permite ajustar a
duração padrão de foco, alertas, timeline, RGB e modo mínimo; alterações são
persistidas pelo Rust e refletidas nas outras views sem reiniciar o app. A seção
de diagnostics mostra somente a versão, o caminho do arquivo local e o estado
resumido de atalhos e autostart. Quando uma integração ainda não está
disponível, o controle fica desabilitado e a mensagem pode ser novamente
carregada; o estado salvo de preferência não é tratado como confirmação de
autostart efetivo. `Tasks` é a superfície funcional descrita abaixo.

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
`list`, `add` e `task` chegam pela query string no preview web e, no desktop,
como o campo `intent` do evento `surface-changed`; são transitórios e não entram
no arquivo persistido. Concluir a tarefa ativa finaliza sua sessão como concluída,
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

Os ícones Linux do bundle ficam em `src-tauri/icons/` nos tamanhos
`32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png` e `icon.png`.

## Licença

MIT — veja [`LICENSE`](LICENSE).

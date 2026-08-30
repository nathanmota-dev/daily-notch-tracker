# PRD - Plano de implementação do MVP do DailyNotch Linux

- Status: plano executável
- Data: 2026-08-30
- Produto: DailyNotch Linux
- Plataforma alvo inicial: Ubuntu Linux x64
- Stack: Tauri 2, React 19, TypeScript, Tailwind CSS, Rust e WebKitGTK
- Fontes: `README.md`, `PRD-TAURI.md`, app macOS em `../daily-notch-tracker-primo` e imagens de referência fornecidas

## 1. Objetivo deste documento

Este documento transforma o escopo de produto do `PRD-TAURI.md` em uma sequência de implementação. Ele deve responder:

1. O que precisa ser construído.
2. Em qual ordem cada feature deve ser feita.
3. Qual camada é responsável por cada comportamento.
4. Como saber que cada etapa foi concluída.
5. Quais testes liberam a passagem para a etapa seguinte.
6. O que faz parte do MVP e o que fica para depois dele.

Este não é um novo produto e não substitui as decisões de escopo do `PRD-TAURI.md`. Em caso de divergência:

1. Este documento define a ordem de execução.
2. O `PRD-TAURI.md` continua sendo a fonte do escopo funcional e técnico.
3. O `README.md` continua sendo a fonte das instruções de setup e desenvolvimento.

## 2. Visão do produto

O DailyNotch Linux é um aplicativo local-first para tarefas e blocos de foco. Ele deve ficar disponível sem ocupar uma janela normal durante o trabalho.

O fluxo principal do MVP é:

1. O app inicia em segundo plano e fica acessível pela tray.
2. O usuário cria ou seleciona uma tarefa.
3. O usuário inicia o foco pela tarefa, tray ou atalho global.
4. Uma pill aparece centralizada no topo do monitor primário, logo abaixo do painel do Ubuntu e de sua data/hora.
5. A pill mostra o tempo restante, a tarefa ativa e o progresso.
6. Ao passar o mouse, a pill expande para o dashboard com To Do e Activity.
7. O usuário pausa, retoma, para ou conclui o trabalho sem abrir uma janela grande.
8. O app registra a sessão localmente, atualiza Activity e streak e avisa quando o bloco termina.
9. A janela Tasks oferece a gestão completa de tarefas, datas e configurações.
10. Fechar Tasks ou Settings não encerra o processo, a tray nem o timer.

## 3. Estado inicial do repositório

O trabalho não começa do zero. A fundação existente já contém:

- React, TypeScript, Vite e Tailwind CSS.
- Tauri 2 e um crate Rust.
- Vitest e um teste inicial do frontend.
- Um comando Rust `greet` usado para verificar a ponte Tauri.
- Uma janela Tauri normal chamada `main`.
- Configuração inicial de ícone, identifier e capabilities.

Ainda não estão implementados:

- Interface do widget.
- Janela Tasks real.
- Modelos de domínio.
- Persistência local.
- Timer de foco.
- Eventos de sincronização entre Rust e React.
- Tray, single-instance, hotkey, notificações, som e autostart.
- Posicionamento e comportamento de overlay no Ubuntu.
- Empacotamento AppImage e `.deb`.

### 3.1 Decisão sobre a estrutura

O `PRD-TAURI.md` propõe uma pasta `tauri/` porque foi escrito considerando o app macOS e o novo app lado a lado. Este repositório já é o app Linux independente. Portanto:

- O app Tauri permanece na raiz atual.
- Não será criada uma pasta `tauri/` dentro deste repositório.
- O código em `../daily-notch-tracker-primo` é apenas referência visual e funcional.
- Nenhum arquivo Swift, estado ou dado do app macOS será importado.

## 4. Definição do MVP

O MVP deve ser um aplicativo instalável e utilizável diariamente, não apenas uma demonstração visual.

### 4.1 Obrigatório para o MVP

- Widget recolhido e dashboard expandido visualmente próximos das imagens de referência.
- Overlay centralizado no monitor primário abaixo do painel do Ubuntu.
- Estados idle, running e paused.
- Expansão por hover e recolhimento estável.
- Tarefas com criação, edição, conclusão, exclusão e reorder.
- Tarefas do dia e tarefas sem data.
- Duração estimada individual por tarefa.
- Focus engine em Rust, orientado por timestamps.
- Persistência local em JSON versionado e escrita atômica.
- Activity mensal e streak.
- Janela Tasks com calendário mensal, Day, Unscheduled, formulário inline e detalhe.
- Settings de foco, notificações, som, timeline, RGB, modo minimal e autostart.
- Tray com ações principais e Quit.
- Single-instance.
- Atalho global `Ctrl+Shift+Space`.
- Notificação e som ao concluir.
- Fallback funcional pela tray e janela Tasks quando o overlay tiver limitações.
- AppImage e `.deb`.
- Validação no Ubuntu alvo em Wayland e X11.

### 4.2 Não bloqueia o MVP core

O `PRD-TAURI.md` define o calendário externo como ausente do MVP core. Para não perder esse escopo, a integração ICS aparece neste documento como a primeira etapa após o MVP:

- Arquivo `.ics` local ou URL `.ics` em modo somente leitura.
- Eventos do dia selecionado na janela Tasks.

O update checker é pequeno e pode entrar no mesmo ciclo do empacotamento. Se bloquear a release, ele pode ser adiado sem comprometer o fluxo principal de tarefas e foco.

### 4.3 Fora do MVP

- Break timer.
- Login, backend ou sincronização de tarefas.
- Google Calendar ou Microsoft Graph com OAuth.
- Escrita em calendários.
- Migração do JSON do app macOS.
- Uma instância do widget em cada monitor.
- Widget seguindo o cursor entre monitores.
- Extensão GNOME ou layer-shell nativo.
- Snap e Flatpak.
- Atualização automática silenciosa.
- Telemetria.

## 5. Superfícies e experiência esperada

### 5.1 Tela A - widget recolhido

Referência: primeira imagem fornecida, com canvas de 369 x 83 px.

Objetivo: manter o foco visível com o mínimo de distração.

Layout inicial a ser calibrado:

- Largura visual aproximada de 360 px no modo normal.
- Altura visual aproximada de 64 a 72 px, incluindo a timeline.
- Fundo preto e região externa totalmente transparente.
- Cantos inferiores e superiores arredondados, sem decoração nativa.
- Contagem regressiva na esquerda, com ícone de relógio.
- Nome da tarefa na direita, em uma linha e com ellipsis.
- Espaço central suficiente para preservar a composição da referência, mas sem simular um notch físico obrigatório.
- Timeline azul contornando laterais e borda inferior.
- Progresso da timeline de 0 a 100 por cento.
- Texto principal branco e texto secundário cinza.
- Dígitos monoespaçados para evitar mudança de largura durante a contagem.

Estados:

- `idle`: janela visualmente oculta.
- `running`: tempo, tarefa e timeline em azul.
- `paused`: tempo congelado e indicação de pausa em vermelho.
- `minimal`: sem tempo e sem nome; apenas a pill reduzida e, se habilitada, a timeline.
- `timeline-off`: sem contorno de progresso e com altura reduzida.
- `rgb`: gradiente animado e glow, respeitando a preferência do usuário.

Regras:

- O título vazio deve reservar uma apresentação válida para foco sem tarefa.
- Títulos longos nunca podem aumentar a largura do widget.
- A contagem visual pode interpolar no React, mas o valor correto sempre vem do Rust.
- Se a sessão terminar enquanto o pointer está sobre o widget, a UI deve transicionar para idle sem ficar presa aberta.

### 5.2 Tela B - dashboard expandido

Referência: segunda imagem fornecida, com canvas de 605 x 199 px, e implementação macOS de referência com largura alvo de 620 px.

Objetivo: permitir controle rápido sem abrir a janela Tasks.

Layout inicial:

- Largura alvo de 620 px.
- Altura dinâmica, com mínimo visual próximo de 190 px.
- Fundo preto e borda/timeline azul nas laterais e parte inferior.
- Duas colunas separadas por divisor fino.
- Coluna esquerda flexível para To Do.
- Coluna direita de aproximadamente 204 px para Activity.
- Padding horizontal aproximado de 18 px.
- Gap de 16 px entre blocos.

Coluna To Do:

- Cabeçalho `To Do` com ícone e ação para abrir Tasks.
- Exatamente duas linhas de tarefa visíveis.
- Scroll vertical sem barra visível quando houver mais de duas tarefas.
- Checkbox, título, nota opcional, duração e botão play/pause.
- Tarefa concluída riscada, com opacidade reduzida e movida para o fim.
- Drag handle de seis pontos como única área de reorder.
- Ação `Add a task` abre a janela Tasks já pronta para adicionar.

Coluna Activity:

- Cabeçalho `Activity`.
- Heatmap do mês atual em grade Monday-first.
- Sete colunas.
- Mostrar apenas as semanas necessárias do início do mês até hoje.
- Células futuras ou fora do mês transparentes.
- Cinco intensidades: zero e quatro níveis de atividade.
- Streak atual visível no cabeçalho ou ao lado da grade, seguindo o design final.

Interação de hover:

- Expandir imediatamente ao entrar no widget.
- Animar tamanho e opacidade em aproximadamente 240 ms.
- Recolher cerca de 400 ms após o pointer sair.
- Cancelar o recolhimento se o pointer voltar.
- Manter expandido enquanto popover de duração ou outro menu filho estiver aberto.
- Evitar loop de expandir/recolher quando a janela muda de tamanho sob o cursor.

### 5.3 Janela Tasks

Janela normal, redimensionável, com tamanho mínimo de 760 x 480 px.

Estrutura:

- Coluna esquerda de aproximadamente 320 px.
- Cabeçalho `Tasks` e botão Settings.
- Calendário mensal Monday-first com mês anterior, próximo e Today.
- Dia selecionado destacado e dia atual marcado.
- Coluna direita com título do dia e tabs Day/Unscheduled.
- Lista com scroll, reorder e controles de tarefa.
- Seção de eventos somente quando ICS estiver implementado.
- `Add a task` alterna para formulário inline.
- Formulário com title, notes, Add e Cancel.
- Clique na tarefa abre o detalhe.

Detalhe da tarefa:

- Editar title, notes, focus time, date e completed.
- Ações Delete, Start e Save.
- Limite de 150 caracteres no título.
- Limite de 500 caracteres nas notas.
- Focus time entre 1 e 180 minutos.
- Presets de duração e ajuste de um minuto.

### 5.4 Settings

Janela ou modal escuro com seções:

- Timer: duração padrão de foco.
- Alerts: notificação e som.
- Appearance: timeline, RGB e modo minimal.
- Startup: launch at login.
- Shortcut: status do atalho global e erro recuperável.
- Calendar: fonte ICS, após o MVP core.
- Diagnostics: versão e caminho do arquivo local, se necessário para suporte.

### 5.5 Tray

Menu mínimo:

- Open Tasks.
- Start focus ou Stop focus, atualizado com o estado.
- Settings.
- Diagnóstico do hotkey quando houver falha.
- Versão ou update disponível.
- Quit DailyNotch.

O app nunca deve depender exclusivamente do clique esquerdo no ícone da tray.

## 6. Arquitetura de implementação

### 6.1 Janelas Tauri

Usar labels explícitos:

- `overlay`: widget recolhido e dashboard expandido.
- `tasks`: janela completa de tarefas.
- `settings`: Settings, se for uma janela separada.

O frontend pode compartilhar o mesmo bundle. Um router de superfície deve escolher o root React pelo label da janela. No navegador, uma query string ou fixture de desenvolvimento deve permitir renderizar cada superfície isoladamente.

Configuração esperada do overlay:

- `decorations: false`.
- `transparent: true`.
- `alwaysOnTop: true`, como melhor esforço.
- `resizable: false`.
- `skipTaskbar: true`.
- Fundo do documento transparente.
- Tamanho controlado pelo estado recolhido/expandido.
- Sem shadow nativo que revele o retângulo da janela.

### 6.2 React

Responsável por:

- Componentes visuais e estados de apresentação.
- Animação do widget.
- Hover, popovers, modais e drag-to-reorder.
- Validação imediata de formulário.
- Formatação de data, tempo e labels.
- Invocação de uma API Tauri pequena e tipada.
- Assinatura dos eventos emitidos pelo Rust.
- Fixtures determinísticas para testes visuais e de componentes.

React não deve:

- Persistir o domínio em `localStorage`.
- Ser a fonte de verdade do timer.
- Calcular a conclusão de uma sessão com base em ticks do webview.
- Expor acesso amplo ao filesystem ou shell.

### 6.3 Rust

Responsável por:

- Estado global do aplicativo.
- Regras de tarefas, sessões, settings e streak.
- Persistência e recuperação do JSON.
- Timer e scheduler.
- Tray e lifecycle.
- Single-instance.
- Hotkey global.
- Notificações e som.
- Autostart.
- Posicionamento e redimensionamento de janelas quando a API exigir backend.
- Update checker e abertura segura de release.
- Emissão de snapshots e eventos para todas as janelas.

### 6.4 Modelo de dados

Contrato mínimo:

```ts
type Task = {
  id: string;
  title: string;
  notes: string;
  scheduledDate: string | null;
  estimateMinutes: number;
  isDone: boolean;
  createdAt: string;
  focusedSeconds: number;
  sortOrder: number;
};

type FocusSession = {
  id: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string;
  focusedSeconds: number;
  completed: boolean;
};

type FocusSettings = {
  focusMinutes: number;
  notificationsEnabled: boolean;
  playSound: boolean;
  showTimeline: boolean;
  rainbowTimeline: boolean;
  minimalMode: boolean;
  launchAtLogin: boolean;
};

type FocusSnapshot = {
  state: "idle" | "running" | "paused";
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  startedAt: string | null;
  endAt: string | null;
  pausedRemainingMs: number | null;
  totalMs: number;
};

type AppSnapshot = {
  tasks: Task[];
  sessions: FocusSession[];
  settings: FocusSettings;
  focus: FocusSnapshot;
  shortcutStatus: "registered" | "unavailable" | "error";
};
```

O payload persistido deve conter `schema_version`. Campos novos de settings devem ter defaults tolerantes para que arquivos antigos continuem abrindo.

`focusedSeconds` representa tempo efetivamente executado e não deve incluir o período em pausa. A diferença entre `endedAt` e `startedAt` é apenas tempo de relógio e pode ser maior que o foco acumulado.

### 6.5 Ordenação de tarefas

Ordem estável em cada lista:

1. Não concluídas antes das concluídas.
2. `sortOrder` crescente.
3. `createdAt` como desempate.

O reorder recebe a lista visível, move o item e recalcula `sortOrder` apenas dentro daquele bucket de data. Reorder em Day não deve alterar a ordem de Unscheduled e vice-versa.

### 6.6 Contrato de comandos e eventos

Comandos mínimos:

```text
get_snapshot
add_task
update_task
delete_task
toggle_task
move_tasks
start_focus
pause_focus
resume_focus
stop_focus
toggle_focus
update_settings
get_app_diagnostics
set_autostart
open_tasks_window(intent?)
open_settings_window
open_external_release
```

Eventos mínimos:

```text
store-changed
focus-changed
settings-changed
shortcut-changed
window-placement-changed
```

Regras do contrato:

- Todo comando valida input no Rust.
- Todo comando mutável retorna o snapshot novo ou confirma a versão do estado.
- Eventos carregam payload suficiente para evitar polling constante.
- Uma janela aberta depois de um evento sempre recupera o estado com `get_snapshot`.
- Falha de uma janela ao processar evento não compromete o estado global.

## 7. Roadmap ordenado até o MVP

Cada etapa abaixo tem um gate. Uma etapa só é considerada concluída quando sua entrega, critérios de aceite e testes estiverem verdes.

### 7.1 Etapa 0 - congelar contratos e proteger a fundação

Objetivo: preparar o repositório para evoluir sem misturar protótipo, domínio e integrações.

Implementação:

- Registrar no código os labels `overlay`, `tasks` e `settings`.
- Criar pastas `components`, `features`, `lib`, `pages` e seus equivalentes Rust conforme forem usadas.
- Criar tipos frontend compartilhados para Task, FocusSession, FocusSettings e snapshots.
- Criar um adaptador `desktopApi` para encapsular `invoke` e `listen`.
- Criar um modo browser/mock para que a UI rode sem Tauri durante desenvolvimento e testes.
- Trocar o teste da starter screen por um teste de shell, preservando o teste da ponte Rust até os novos comandos existirem.
- Manter `npm run build`, `npm test` e `npm run test:rust` como gates obrigatórios.

Critérios de aceite:

- [ ] O app atual continua compilando.
- [ ] Nenhum componente importa `invoke` diretamente fora do adaptador.
- [ ] As superfícies podem receber snapshots mockados.
- [ ] O código Swift do diretório pai não participa do build.

Testes:

- Build TypeScript/Vite.
- Teste do adaptador mock.
- Teste Rust atual.

Dependências: nenhuma.

### 7.2 Etapa 1 - design system e primitivas da interface

Objetivo: criar uma linguagem visual única antes das duas telas principais.

Implementação:

- Definir tokens CSS para preto, panel `#1a1a1a`, panel-hover `#292929`, branco, cinza, azul e vermelho.
- Definir raios de 8, 12, 14, 16 e 22 px.
- Definir tipografia, dígitos monoespaçados, shadows e glow RGB.
- Criar ícones SVG próprios ou adotar uma biblioteca pequena com tree-shaking.
- Criar componentes Button, IconButton, Panel, Checkbox, Divider, ScrollArea, Toggle e FocusTimePicker.
- Criar `ProgressTray` com track completo e fill proporcional.
- Garantir CSS compatível com WebKitGTK, incluindo fallback se `backdrop-filter` não estiver disponível.
- Remover qualquer fundo opaco global que impeça a transparência do overlay.

Critérios de aceite:

- [ ] Tokens são usados pelas superfícies, sem cores duplicadas em vários componentes.
- [ ] Todos os controles têm estados hover, focus-visible, active e disabled.
- [ ] Ícones não dependem de SF Symbols.
- [ ] A UI funciona com teclado nas janelas normais.

Testes:

- Testes de renderização dos controles.
- Testes de acessibilidade básica por role e label.
- Verificação manual em WebKitGTK.

Dependência: Etapa 0.

### 7.3 Etapa 2 - tela A estática, widget recolhido

Objetivo: reproduzir a primeira imagem antes de conectar domínio ou posicionamento do sistema.

Implementação:

- Criar `CollapsedFocusWidget`.
- Renderizar fixtures running, paused, no-task, long-title, minimal, timeline-off e RGB.
- Fixar a composição horizontal de timer e tarefa.
- Implementar ellipsis do título.
- Implementar timeline contornando lados e base, sem corte nos cantos.
- Animar o fill linearmente sem alterar a fonte de verdade.
- Manter o canvas do body transparente.

Critérios de aceite:

- [ ] A fixture running é visualmente comparável à imagem 1.
- [ ] O tamanho não muda quando os segundos ou o título mudam.
- [ ] O progresso 0, 50 e 100 por cento é desenhado corretamente.
- [ ] Paused, minimal e timeline-off são distinguíveis.
- [ ] Não há retângulo de fundo fora da pill.

Testes:

- Formatação `MM:SS`.
- Clamp de progress entre 0 e 1.
- Título longo.
- Snapshot visual manual nos estados definidos.

Dependência: Etapa 1.

### 7.4 Etapa 3 - tela B estática, dashboard expandido

Objetivo: reproduzir a segunda imagem com dados mockados.

Implementação:

- Criar `ExpandedDashboard` com largura alvo de 620 px.
- Criar `TodoPanel`, `CompactTaskRow`, `DragHandle`, `ActivityHeatmap` e cabeçalhos.
- Mostrar duas tarefas e ativar scroll a partir da terceira.
- Implementar estados vazio, uma tarefa, duas tarefas, overflow e tarefas concluídas.
- Implementar play/pause, checkbox e duração apenas como callbacks de fixture.
- Implementar heatmap Monday-first para meses que usam quatro, cinco ou seis linhas.
- Implementar intensidade visual de zero a quatro níveis.
- Manter a borda/timeline expandida mesmo sem sessão ativa no fixture.
- Criar action `Add a task` e botão de abrir a janela completa.

Critérios de aceite:

- [ ] A fixture principal é visualmente comparável à imagem 2.
- [ ] Somente duas task rows ficam visíveis sem scroll.
- [ ] A coluna Activity não encolhe quando o título da tarefa cresce.
- [ ] Datas futuras e externas ao mês não desenham célula ativa.
- [ ] O layout permanece estável nos diferentes números de semanas.

Testes:

- Cálculo Monday-first.
- Quantidade de linhas até hoje.
- Escala de intensidade.
- Ordenação visual de concluídas.
- Ações expostas pelos botões.

Dependências: Etapas 1 e 2.

### 7.5 Etapa 4 - transformar as telas em uma janela Tauri de overlay

Objetivo: executar as duas telas dentro do webview real e validar transparência e resize.

Implementação:

- Substituir a janela `main` pela janela `overlay` ou criar `overlay` programaticamente no startup.
- Configurar janela sem decoração, transparente, sem resize e fora da taskbar.
- Criar o surface router por label.
- Aplicar o tamanho recolhido no estado inicial de desenvolvimento.
- Alternar para 620 px e altura calculada no estado expandido.
- Manter o topo da janela ancorado durante o resize.
- Validar pointer events dentro da pill e ausência de área opaca fora dela.
- Definir capabilities mínimas específicas para o overlay.

Critérios de aceite:

- [ ] A pill roda com `npm run tauri:dev` no WebKitGTK.
- [ ] O desktop aparece através da região transparente.
- [ ] A janela não tem titlebar, resize handle ou taskbar entry.
- [ ] O resize não move o centro horizontal visual.
- [ ] Controles recebem clique.
- [ ] A janela comum de demonstração deixou de ser a entrada do produto.

Testes:

- Smoke manual em sessão Wayland.
- Smoke manual em sessão X11.
- Teste de configuração/capabilities quando aplicável.

Dependências: Etapas 2 e 3.

Gate de risco:

- Se transparência ou always-on-top forem inconsistentes, registrar a limitação e manter tray/Tasks como fallback oficial.
- Se Wayland ignorar posição programática, não bloquear o restante do MVP. Validar a melhor posição possível e documentar a limitação por compositor.

### 7.6 Etapa 5 - posição abaixo da data/hora e comportamento de hover

Objetivo: colocar o widget no ponto de uso esperado no Ubuntu.

Implementação de posição:

1. Descobrir o monitor primário.
2. Ler tamanho físico, scale factor, posição e work area quando disponíveis.
3. Calcular `x = monitor.x + (monitor.width - overlay.width) / 2`.
4. Calcular `y` logo abaixo do painel superior, usando work area ou uma margem configurada de fallback.
5. Usar uma margem visual inicial entre 4 e 8 px abaixo do painel.
6. Arredondar coordenadas para pixels físicos para evitar bordas borradas.
7. Recalcular ao trocar resolução, escala, monitor primário ou conectar display.
8. Preservar o centro horizontal quando a largura muda de recolhida para expandida.

Implementação de hover:

- Expandir imediatamente em pointer enter.
- Recolher após aproximadamente 400 ms em pointer leave.
- Cancelar timeout quando o pointer retornar.
- Usar hold counter para popovers e menus filhos.
- Bloquear timers de recolhimento duplicados.
- Esconder o overlay quando o foco voltar a idle.

Critérios de aceite:

- [ ] Em um desktop Ubuntu padrão, a pill fica centralizada sob a data/hora, sem cobrir o painel.
- [ ] O centro horizontal não salta durante a animação.
- [ ] Hover não produz flicker.
- [ ] O usuário consegue mover o pointer para um popover sem recolhimento.
- [ ] Mudança de escala não deixa a pill fora da tela.
- [ ] Limitações específicas de Wayland ficam documentadas.

Testes:

- Função pura de cálculo de posição para monitores com origens e escalas diferentes.
- Teste do debounce de recolhimento.
- QA manual em 100, 125, 150 e 200 por cento de escala quando disponíveis.

Dependência: Etapa 4.

### 7.7 Etapa 6 - domínio Rust para tarefas, sessões e settings

Objetivo: criar a fonte de verdade sem ainda depender da UI final.

Implementação:

- Criar módulos `domain/task`, `domain/session`, `domain/settings` e `domain/streak`.
- Usar UUIDs.
- Validar título não vazio após trim.
- Aplicar limites de 150 e 500 caracteres.
- Clamp de duração entre 1 e 180 minutos.
- Normalizar datas e cálculos no timezone local.
- Implementar criação, atualização, conclusão, exclusão e reorder.
- Implementar queries por dia e sem data.
- Implementar sessão completed e aborted.
- Implementar soma de `focusedSeconds`.
- Implementar streak que termina hoje ou ontem.
- Manter a regra inicial de que qualquer sessão registrada conta para Activity.

Critérios de aceite:

- [ ] Todas as regras de domínio funcionam sem Tauri e sem React.
- [ ] Concluídas sempre ficam após não concluídas.
- [ ] Reorder é estável.
- [ ] Datas de dias diferentes não se misturam.
- [ ] Streak lida com hoje, ontem, gaps e virada de mês.

Testes Rust:

- CRUD e validações.
- Ordenação e reorder.
- Day e Unscheduled.
- Soma de focusedSeconds.
- Activity por timezone local.
- Streak 0, 1 e múltiplos dias.

Dependência: Etapa 0.

### 7.8 Etapa 7 - repository e persistência segura

Objetivo: fazer os dados sobreviverem ao restart sem risco de perda silenciosa.

Implementação:

- Criar `PersistedPayload` com `schema_version`.
- Resolver o arquivo por `app_data_dir`.
- Criar diretório de dados no primeiro uso.
- Ler arquivo inexistente como estado vazio válido.
- Escrever em arquivo temporário e renomear atomicamente.
- Manter um único writer sob o estado global Rust.
- Salvar após mutações relevantes ou com debounce curto e flush garantido.
- Se JSON estiver inválido, preservar o original e iniciar estado recuperável com erro diagnóstico.
- Criar estratégia de backup antes de futuras mudanças de schema.
- Não usar caminhos hardcoded de usuário.

Critérios de aceite:

- [ ] Primeiro launch abre vazio sem erro.
- [ ] Tarefas, sessões e settings sobrevivem ao restart.
- [ ] Escrita interrompida não substitui o último arquivo válido.
- [ ] JSON inválido não é apagado.
- [ ] O caminho real pode ser mostrado em diagnostics ou documentado.

Testes Rust:

- Roundtrip completo.
- Arquivo inexistente.
- JSON inválido.
- Schema desconhecido.
- Campos opcionais de settings ausentes.
- Falha de escrita simulada quando possível.

Dependência: Etapa 6.

### 7.9 Etapa 8 - estado global, IPC e sincronização entre janelas

Objetivo: conectar React e Rust com um contrato único.

Implementação:

- Criar `AppState` gerenciado pelo Tauri.
- Expor `get_snapshot`.
- Expor comandos de tarefas e settings.
- Emitir `store-changed` após mutações persistidas.
- Fazer overlay, Tasks e Settings carregarem snapshot inicial.
- Atualizar todas as janelas com o mesmo evento.
- Tratar janela fechada ou listener removido sem panic.
- Mapear erros Rust para códigos e mensagens apresentáveis.
- Separar capabilities por janela.

Critérios de aceite:

- [ ] Criar tarefa em Tasks atualiza o overlay sem reload.
- [ ] Concluir tarefa no overlay atualiza Tasks aberta.
- [ ] Abrir uma janela depois recupera o estado mais recente.
- [ ] Erros de validação aparecem sem corromper o estado.
- [ ] React não lê nem escreve o JSON diretamente.

Testes:

- Testes Rust dos commands.
- Testes frontend do `desktopApi` real mockado.
- Teste de reducer/store frontend ao receber eventos fora de ordem ou duplicados.

Dependências: Etapas 6 e 7.

### 7.10 Etapa 9 - tarefas reais no dashboard expandido

Objetivo: substituir fixtures da tela B por dados persistidos.

Implementação:

- Filtrar tarefas do dia atual.
- Conectar checkbox, play placeholder, duração e open detail.
- Conectar reorder por drag handle ao comando Rust.
- Reconciliar a lista quando a resposta do Rust retornar.
- Mostrar estado vazio com action para abrir Tasks.
- Abrir a janela Tasks a partir do header e de `Add a task`.
- Enviar intent `add` para que `Add a task` abra a janela com o formulário e o title em foco.
- Ao clicar no corpo da tarefa, abrir Tasks e solicitar o detalhe daquele ID.
- Manter concluídas visíveis no fim da lista.

Critérios de aceite:

- [ ] Dados do dashboard vêm do Rust.
- [ ] Reorder persiste após restart.
- [ ] Concluir uma tarefa a move para o fim sem desaparecer.
- [ ] `Add a task` abre a superfície correta.
- [ ] Uma lista longa continua limitada a duas linhas visíveis.

Testes:

- Lista vazia, curta e longa.
- Conclusão e reorder.
- Abertura da task correta.
- Erro IPC com rollback ou refetch seguro.

Dependências: Etapas 3 e 8.

### 7.11 Etapa 10 - focus engine em Rust

Objetivo: implementar um timer correto mesmo com webview suspenso ou sistema bloqueado.

Máquina de estados:

```text
idle -> running
running -> paused
paused -> running
running -> idle ao completar ou parar
paused -> idle ao parar
running/paused -> idle ao concluir ou excluir a tarefa ativa
```

Implementação:

- Iniciar por `estimateMinutes` quando houver tarefa.
- Usar `settings.focusMinutes` para sessão sem tarefa.
- Armazenar `started_at`, `end_at`, total e tempo restante na pausa.
- Acumular separadamente o tempo efetivamente running para não contar intervalos em pause.
- Derivar remaining do relógio atual, nunca do número de ticks.
- Criar scheduler cancelável para a conclusão.
- Cancelar e recriar o scheduler em pause, resume, stop e novo start.
- Antes de concluir, comparar `now >= end_at`.
- Em pause, congelar remaining e remover `end_at` ativo.
- Em resume, calcular novo `end_at`.
- Em stop, registrar sessão aborted quando houver tempo válido.
- Em complete, registrar completed, somar tempo à tarefa e notificar integrações.
- Ao concluir tarefa ativa, parar e registrar a sessão.
- Ao excluir tarefa ativa, parar sem registrar tempo contra a tarefa removida.
- Emitir `focus-changed` em toda transição.

Semântica do atalho:

- Se há foco, `toggle_focus` para e registra.
- Se não há foco, inicia a primeira tarefa não concluída de hoje.
- Se o dia está vazio, inicia sessão sem tarefa com a duração padrão.
- O atalho não é pause/resume no MVP; pause/resume continua nos controles visuais.

Critérios de aceite:

- [ ] Start, pause, resume, stop e complete obedecem à máquina de estados.
- [ ] Não existem dois schedulers ativos.
- [ ] Trocar de tarefa encerra corretamente a sessão anterior.
- [ ] O cálculo continua correto após atraso grande entre updates.
- [ ] Sessões e focusedSeconds são persistidos.

Testes Rust com relógio controlável:

- Conclusão normal.
- Pause e resume.
- Stop antecipado.
- Troca de tarefa.
- Lock/suspend simulados por avanço do relógio.
- Exclusão e conclusão da tarefa ativa.
- Duração mínima e máxima.

Dependências: Etapas 6, 7 e 8.

### 7.12 Etapa 11 - conectar o focus engine ao widget

Objetivo: transformar a tela A e os controles da tela B em UI funcional.

Implementação:

- Escutar `focus-changed`.
- Derivar remaining localmente entre eventos usando `end_at`, apenas para renderização.
- Fazer resync periódico leve ou ao recuperar foco/visibilidade.
- Mostrar widget quando running ou paused.
- Esconder widget quando idle.
- Conectar play, pause e resume em cada task row.
- Mostrar a tarefa ativa correta.
- Atualizar timeline por `elapsed / total`.
- Atualizar tamanho para minimal e timeline-off.
- Impedir duplo clique de enviar transições conflitantes.
- Garantir que uma conclusão emitida pelo Rust prevaleça sobre animação local.

Critérios de aceite:

- [ ] O tempo visual coincide com o snapshot Rust.
- [ ] Pausar congela o contador e muda o estado visual.
- [ ] Retomar não perde nem duplica tempo.
- [ ] Ao terminar, a pill some e Activity atualiza.
- [ ] Iniciar outra tarefa atualiza nome, total e progresso.
- [ ] O overlay não precisa estar focado para continuar correto.

Testes:

- Hook de countdown com relógio fake.
- Eventos running, paused, completed e idle.
- Reconnect/resync após visibilidade oculta.
- Interações rápidas e comandos em andamento.

Dependências: Etapas 5, 9 e 10.

### 7.13 Etapa 12 - Activity e streak reais

Objetivo: conectar o histórico de sessões à coluna direita do dashboard.

Implementação:

- Calcular contagens diárias no Rust ou em selector determinístico compartilhado.
- Fixar timezone local e Monday-first.
- Atualizar heatmap ao receber sessão nova.
- Mostrar streak que termina hoje ou ontem.
- Manter sessões aborted no critério inicial de Activity, conforme o PRD.
- Não mostrar dias futuros.
- Garantir virada de mês sem estado antigo.

Critérios de aceite:

- [ ] Uma sessão registrada altera o dia correto.
- [ ] Intensidade aumenta conforme o número de sessões.
- [ ] Streak não quebra quando hoje está vazio, mas ontem teve atividade.
- [ ] Streak quebra após mais de um dia vazio.
- [ ] Virada de mês não mistura posições da grade.

Testes:

- Meses começando em cada dia da semana.
- Fevereiro e ano bissexto.
- Virada de mês e ano.
- Timezone perto da meia-noite.
- Streak terminando hoje, ontem e inexistente.

Dependências: Etapas 10 e 11.

### 7.14 Etapa 13 - janela Tasks completa

Objetivo: entregar a gestão completa de tarefas fora do overlay.

Implementação:

- Criar a janela `tasks` sob demanda.
- Criar calendário mensal Monday-first.
- Navegar mês anterior/próximo e voltar para Today.
- Alternar Day e Unscheduled.
- Renderizar lista com scroll, reorder e controles.
- Implementar formulário inline e autofoco no title.
- Aplicar contador e limite de caracteres.
- Implementar detalhe com Save, Start, Delete e Completed.
- Implementar FocusTimePicker com presets e passos de um minuto.
- Receber `pending task id` quando aberto pelo dashboard.
- Fechar a janela sem encerrar o processo.
- Reabrir com estado atualizado.

Critérios de aceite:

- [ ] Criar com data e sem data funciona.
- [ ] Editar todos os campos funciona.
- [ ] Day e Unscheduled filtram corretamente.
- [ ] Reorder persiste e coincide com o dashboard.
- [ ] Start no detalhe inicia o timer correto.
- [ ] Delete e Completed respeitam a tarefa ativa.
- [ ] Fechar e reabrir não perde dados nem encerra o timer.

Testes:

- Calendário e seleção de dia.
- CRUD completo.
- Validação de campos.
- Tabs e filtros.
- Detalhe aberto por ID.
- Integração com foco.

Dependências: Etapas 8, 9 e 10.

### 7.15 Etapa 14 - Settings e preferências de aparência

Objetivo: permitir que o usuário configure o comportamento sem editar arquivos.

Implementação:

- Criar Settings como janela ou modal acessível pelo header e tray.
- Implementar duração padrão entre 1 e 180 minutos.
- Implementar toggles de notificação, som, timeline, RGB e minimal.
- Persistir cada mudança pelo Rust.
- Aplicar mudanças de appearance imediatamente ao overlay.
- Mostrar status do hotkey.
- Mostrar estado real do autostart, não apenas último valor salvo.
- Expor versão e caminho dos dados em diagnostics.
- Evitar que RGB ligue visualmente a timeline quando `showTimeline` estiver desligado.

Critérios de aceite:

- [ ] Settings sobrevivem ao restart.
- [ ] Mudanças visuais aparecem sem reiniciar.
- [ ] Nova tarefa usa a duração padrão atual.
- [ ] Settings mostra falhas recuperáveis de integração.
- [ ] Fechar Settings não encerra o app.

Testes:

- Defaults e clamps.
- Persistência.
- Aplicação imediata no overlay.
- Dependência visual entre timeline e RGB.

Dependências: Etapas 8, 11 e 13.

### 7.16 Etapa 15 - lifecycle, single-instance e tray

Objetivo: fazer o produto se comportar como utilitário de desktop.

Implementação:

- Instalar e inicializar single-instance antes de plugins dependentes do lifecycle.
- No segundo launch, focar Tasks ou sinalizar a instância existente.
- Criar tray com ícone e menu real.
- Atualizar Start/Stop conforme focus state.
- Abrir Tasks e Settings pelo menu.
- Implementar Quit explícito.
- Interceptar close de Tasks/Settings para apenas esconder ou destruir a janela, mantendo o processo.
- Liberar hotkey, scheduler e recursos em Quit.
- Iniciar sem janela normal aberta.
- Garantir que o app funcione sem terminal.

Critérios de aceite:

- [ ] Apenas um processo funcional fica ativo.
- [ ] Fechar janelas mantém tray e timer.
- [ ] Quit encerra tudo.
- [ ] Menu muda entre Start e Stop imediatamente.
- [ ] Tray continua sendo fallback quando o overlay falha.
- [ ] Limitação de ícone no GNOME sem extensão é documentada, se ocorrer.

Testes:

- Segundo launch.
- Close versus Quit.
- Menu durante running, paused e idle.
- Restart após encerramento limpo.

Dependências: Etapas 10, 13 e 14.

### 7.17 Etapa 16 - integrações do sistema

Objetivo: completar o ciclo diário fora da interface.

#### 7.17.1 Atalho global

- Registrar `Ctrl+Shift+Space` de forma idempotente.
- Mostrar unavailable/error se a combinação estiver ocupada.
- Desregistrar no shutdown.
- Manter tray e UI como fallback.

#### 7.17.2 Notificação

- Solicitar ou verificar permissão quando necessário.
- Enviar `Focus block complete` com o título da tarefa.
- Respeitar settings.
- Falhar sem crash quando o backend do desktop não existir.

#### 7.17.3 Som

- Tocar asset curto ou solução Rust compatível com Linux.
- Respeitar settings.
- Não atrasar nem bloquear persistência da sessão.
- Falhar sem crash quando áudio não estiver disponível.

#### 7.17.4 Autostart

- Ligar e desligar autostart do usuário.
- Ler estado real.
- Iniciar minimizado para tray/overlay.
- Testar AppImage e `.deb`.
- Usar adaptador `.desktop` se o plugin não cobrir um formato.

#### 7.17.5 Update checker

- Consultar GitHub Releases no máximo uma vez a cada seis horas.
- Comparar SemVer.
- Mostrar update no menu.
- Abrir somente URL HTTPS permitida.
- Ignorar offline sem interromper o app.

Critérios de aceite:

- [ ] Hotkey inicia ou para foco fora do app.
- [ ] Falha do hotkey fica visível.
- [ ] Notificação e som respeitam settings.
- [ ] Sessão completa mesmo se notificação ou som falhar.
- [ ] Autostart reflete estado real.
- [ ] Offline não bloqueia startup nem update checker.

Testes:

- Adapters Rust com backends mockados.
- Permissão negada.
- Backend ausente.
- Hotkey ocupado.
- Autostart enable/disable.
- SemVer e cache do update checker.

Dependências: Etapas 14 e 15.

### 7.18 Etapa 17 - hardening, QA e distribuição do MVP

Objetivo: transformar a implementação em um MVP instalável.

Implementação:

- Ativar bundle Tauri para AppImage e `.deb`.
- Gerar ícones Linux nos tamanhos necessários.
- Criar desktop entry e metadados.
- Criar CI Ubuntu com build frontend, testes TypeScript, testes Rust e `cargo tauri build`.
- Compilar na baseline Linux mais antiga suportada.
- Testar instalação, execução e remoção.
- Testar upgrade sem perda do JSON.
- Documentar dependências, path de dados e limitações Wayland/tray.
- Remover comando `greet`, starter screen e permissões não usadas.
- Revisar logs para não incluir conteúdo pessoal de tarefas.

Matriz mínima de QA:

| Cenário | X11 | Wayland |
| --- | --- | --- |
| Overlay transparente | obrigatório | obrigatório ou limitação documentada |
| Top center abaixo do painel | obrigatório | melhor esforço com fallback |
| Always-on-top | obrigatório | melhor esforço com fallback |
| Hover e resize | obrigatório | obrigatório |
| Tray e menu | obrigatório | obrigatório ou limitação documentada |
| Hotkey global | obrigatório | obrigatório ou erro visível |
| AppImage | obrigatório | obrigatório |
| `.deb` | obrigatório | obrigatório |

Fluxos de regressão obrigatórios:

1. Primeiro launch sem dados.
2. Criar tarefa de hoje e iniciar foco.
3. Pausar e retomar.
4. Bloquear e desbloquear a sessão do Ubuntu.
5. Suspender e retomar a máquina.
6. Concluir naturalmente.
7. Validar notificação, som, Activity e streak.
8. Fechar Tasks durante o foco e reabrir.
9. Reiniciar o app e validar persistência.
10. Corromper uma cópia do JSON e validar recuperação sem apagar original.
11. Iniciar uma segunda instância.
12. Alternar minimal, timeline e RGB.
13. Conectar ou desconectar monitor e validar reposicionamento.
14. Testar offline.

Critérios de aceite:

- [ ] Todos os testes automatizados passam.
- [ ] AppImage e `.deb` são gerados.
- [ ] O app inicia em Ubuntu limpo dentro da baseline.
- [ ] Dados sobrevivem a restart e upgrade.
- [ ] Nenhuma falha de integração derruba o focus engine.
- [ ] README descreve instalação e limitações conhecidas.
- [ ] Não existem dependências do app macOS.

Dependências: todas as etapas anteriores.

## 8. Primeira etapa após o MVP - calendário ICS somente leitura

Esta etapa está planejada, mas não bloqueia o gate do MVP core.

Implementação:

- Criar interface `CalendarProvider` no Rust.
- Implementar arquivo `.ics` local.
- Implementar URL `.ics` HTTPS com timeout e cache moderado.
- Parsear eventos e recorrências dentro do limite suportado pela biblioteca escolhida.
- Filtrar pelo dia selecionado no timezone correto.
- Ordenar por horário de início.
- Expor estados not-configured, loading, loaded, empty e error.
- Atualizar ao abrir Tasks e em intervalo moderado.
- Nunca modificar o calendário.
- Não guardar credenciais OAuth.

Critérios de aceite:

- [ ] Fonte local e URL funcionam.
- [ ] Eventos corretos aparecem no dia selecionado.
- [ ] Offline usa erro recuperável ou cache.
- [ ] Fonte inválida não afeta tarefas e foco.
- [ ] Nenhuma operação de escrita é oferecida.

## 9. Marcos de entrega

| Marco | Etapas | Resultado demonstrável |
| --- | --- | --- |
| M0 - Fundação protegida | 0 e 1 | Arquitetura de superfícies e design system |
| M1 - Protótipo visual | 2 e 3 | As duas imagens reproduzidas com fixtures |
| M2 - Overlay Ubuntu | 4 e 5 | Widget transparente, centralizado e com hover |
| M3 - Core local-first | 6 a 10 | Tarefas persistidas e timer Rust funcional |
| M4 - Produto principal | 11 a 14 | Overlay real, Activity, Tasks e Settings |
| M5 - Desktop integration | 15 e 16 | Tray, lifecycle, hotkey, alertas e autostart |
| M6 - MVP instalável | 17 | AppImage e `.deb` validados |
| M7 - Release ampliada | seção 8 | Calendário ICS read-only |

### 9.1 Gate de MVP funcional

O app pode ser chamado de MVP funcional ao concluir M5 e passar os fluxos principais em `tauri:dev`.

### 9.2 Gate de MVP distribuível

O app pode ser entregue a outra pessoa ao concluir M6. Este é o gate recomendado para publicar a versão `0.1.0`.

## 10. Ordem sugerida de issues

Esta lista pode ser copiada para o issue tracker. A ordem já considera dependências.

- [ ] MVP-001 - Criar contratos TypeScript e `desktopApi`.
- [ ] MVP-002 - Criar surface router por window label.
- [ ] MVP-003 - Criar design tokens e ícones.
- [ ] MVP-004 - Criar ProgressTray.
- [ ] MVP-005 - Reproduzir widget recolhido com fixtures.
- [ ] MVP-006 - Reproduzir dashboard expandido com fixtures.
- [ ] MVP-007 - Criar heatmap Monday-first estático.
- [ ] MVP-008 - Configurar janela overlay transparente.
- [ ] MVP-009 - Implementar resize ancorado no topo central.
- [ ] MVP-010 - Implementar posicionamento sob o painel do Ubuntu.
- [ ] MVP-011 - Implementar hover, delay e hold de popover.
- [ ] MVP-012 - Criar modelos Rust e validações.
- [ ] MVP-013 - Criar repository JSON versionado e atômico.
- [ ] MVP-014 - Criar AppState, snapshot, commands e events.
- [ ] MVP-015 - Conectar tarefas reais ao dashboard.
- [ ] MVP-016 - Implementar CRUD e reorder persistidos.
- [ ] MVP-017 - Implementar focus engine orientado por timestamps.
- [ ] MVP-018 - Conectar countdown e timeline ao Rust.
- [ ] MVP-019 - Implementar Activity e streak.
- [ ] MVP-020 - Criar janela Tasks.
- [ ] MVP-021 - Criar calendário mensal Day/Unscheduled.
- [ ] MVP-022 - Criar formulário inline e detalhe de tarefa.
- [ ] MVP-023 - Criar Settings e diagnostics.
- [ ] MVP-024 - Implementar single-instance e lifecycle.
- [ ] MVP-025 - Implementar tray e menu dinâmico.
- [ ] MVP-026 - Implementar hotkey global e diagnóstico.
- [ ] MVP-027 - Implementar notificação e som.
- [ ] MVP-028 - Implementar autostart.
- [ ] MVP-029 - Implementar update checker.
- [ ] MVP-030 - Ativar AppImage e `.deb`.
- [ ] MVP-031 - Criar CI Linux.
- [ ] MVP-032 - Executar QA X11, Wayland, lock e suspend.
- [ ] MVP-033 - Atualizar README e publicar `0.1.0`.
- [ ] POST-001 - Implementar CalendarProvider ICS.

## 11. Rastreabilidade do escopo

| Feature do `PRD-TAURI.md` | Etapa deste plano | Bloqueia MVP |
| --- | --- | --- |
| Widget recolhido | 2, 4, 5 e 11 | sim |
| Dashboard expandido | 3, 4, 5 e 9 | sim |
| Timeline, RGB e minimal | 2, 11 e 14 | sim |
| Tarefas CRUD | 6, 8, 9 e 13 | sim |
| Reorder | 6, 9 e 13 | sim |
| Tasks window | 13 | sim |
| Focus engine Rust | 10 e 11 | sim |
| Activity e streak | 6 e 12 | sim |
| Persistência local | 7 | sim |
| Settings | 14 | sim |
| Single-instance | 15 | sim |
| Tray | 15 | sim |
| Hotkey global | 16 | sim |
| Notificação e som | 16 | sim |
| Autostart | 16 | sim |
| Update checker | 16 | desejável |
| ICS read-only | seção 8 | não para MVP core |
| AppImage e `.deb` | 17 | sim para distribuição |
| QA X11 e Wayland | 17 | sim |

## 12. Definition of Done global

Uma issue só está pronta quando:

- O comportamento está integrado, não apenas renderizado em fixture.
- Os estados loading, empty, success e error relevantes foram tratados.
- Inputs são validados no React e novamente no Rust.
- Testes proporcionais ao risco foram adicionados.
- `npm run build` passa.
- `npm test` passa.
- `npm run test:rust` passa quando a issue toca Rust.
- O comportamento foi verificado no webview Tauri, não apenas no navegador.
- Capabilities foram mantidas mínimas.
- Nenhum log contém títulos ou notas de tarefas sem necessidade.
- A documentação foi atualizada quando o comportamento externo mudou.
- Limitações do compositor foram registradas em vez de ocultadas.

## 13. Decisões de produto que não devem mudar durante o MVP

1. Rust é a fonte de verdade de timer e dados persistidos.
2. O app inicia vazio e não migra dados do macOS.
3. O overlay usa apenas o monitor primário.
4. Idle deixa o overlay oculto; acesso sem foco ocorre por tray, hotkey ou Tasks.
5. `Ctrl+Shift+Space` alterna Start/Stop, não Pause/Resume.
6. Foco de tarefa usa a estimativa da tarefa.
7. Foco sem tarefa usa a duração padrão.
8. Concluir a tarefa ativa encerra e registra a sessão.
9. Excluir a tarefa ativa encerra sem atribuir tempo à tarefa excluída.
10. Tarefas concluídas continuam visíveis no fim da lista.
11. Qualquer sessão registrada conta inicialmente para Activity.
12. Não existe break timer no MVP.
13. Wayland tem fallback oficial por tray e Tasks.
14. Nenhuma falha de tray, som, notificação, update ou autostart pode corromper ou interromper o timer.

## 14. Riscos que devem ser atacados cedo

| Risco | Etapa de validação | Resposta planejada |
| --- | --- | --- |
| Transparência ou posição limitada em Wayland | 4 e 5 | melhor esforço e fallback por tray/Tasks |
| Overlay perde always-on-top | 4, 5 e 17 | registrar limitação por compositor |
| Hover pisca durante resize | 5 | resize ancorado, delay e hold counter |
| Timer deriva em lock/suspend | 10 | timestamps, relógio controlável e resync |
| Estado diverge entre janelas | 8 | Rust global, snapshots e eventos |
| JSON corrompido causa perda | 7 | escrita atômica e preservação do original |
| Tray ausente no GNOME | 15 e 17 | Tasks e hotkey como fallback |
| WebKitGTK renderiza diferente | 1 a 5 | CSS conservador e QA no webview real |
| Autostart difere entre pacotes | 16 e 17 | testar ambos e adaptar `.desktop` |
| glibc/WebKitGTK limitam compatibilidade | 17 | build na baseline mais antiga suportada |

## 15. Resultado esperado ao final

Ao concluir o MVP distribuível, uma pessoa deve conseguir instalar o DailyNotch no Ubuntu, criar tarefas locais, iniciar um bloco de foco por tarefa ou atalho, acompanhar o tempo em uma pill centralizada abaixo da data/hora, expandir essa pill para controlar tarefas e consultar Activity, fechar as janelas sem encerrar o processo e recuperar todos os dados após reiniciar o app.

O produto deve permanecer útil mesmo quando o compositor limitar o overlay: tray, hotkey e janela Tasks são superfícies obrigatórias e funcionam como fallback oficial.

# PRD - DailyNotch Linux com Tauri, React e Rust

- Status: proposta inicial
- Data: 2026-08-29
- Produto: DailyNotch Linux
- Plataforma inicial: Ubuntu Linux x64
- Stack: Tauri 2, React, TypeScript e Rust
- Natureza: produto novo, criado do zero

## 1. Escopo deste documento

Este documento descreve um novo app Linux inspirado na interface e no fluxo de uso do DailyNotch macOS existente em ../daily-notch-tracker-primo ou /Desktop/git/daily-notch-tracker-primo.

O app Linux não será uma migração do app macOS. A implementação não deve importar, adaptar ou depender da lógica Swift existente. 

O que pode ser aproveitado como referência:

- Hierarquia visual das telas.
- Layout do widget recolhido e do dashboard expandido.
- Paleta, espaçamentos, raios, estados visuais e animações desejadas.
- Fluxos de uso observados na interface.
- Textos e nomenclatura, quando fizerem sentido no Linux.
- Imagens e referências visuais do diretório de assets, se forem adequadas ao novo app.

O que não faz parte do reaproveitamento:

- Código Swift, SwiftUI ou AppKit.
- Modelos, `Store`, `FocusTimer` ou serviços existentes.
- Arquivo `data.json` do macOS.
- Migração ou importação de dados entre os dois produtos.
- Configuração do Xcode, `Info.plist` ou target macOS.
- Alteração da aplicação macOS para transformá-la em uma aplicação Linux.

Como a interface atual é SwiftUI, não existe um frontend web pronto para copiar. O React será escrito de novo, usando o app atual como especificação visual e funcional.

## 2. Resumo executivo

Tauri + React + Rust é uma boa escolha para este produto novo. A camada React concentra a UI, enquanto Rust fica responsável pelo estado persistente, timer, comandos e integrações com o sistema.

Em comparação com Electron:

- A dificuldade da UI é praticamente a mesma.
- Tauri exige mais configuração inicial por causa de Rust, WebKitGTK e capabilities.
- Tauri tende a produzir um app menor e com menor consumo de recursos, pois usa o webview do sistema.
- Electron tem uma experiência de desenvolvimento mais direta e um Chromium embutido mais previsível.
- No Ubuntu, Tauri adiciona uma dependência importante de WebKitGTK e de compatibilidade entre versões do sistema.
- O risco do overlay no Wayland existe nas duas opções, porque depende do window manager e do compositor, não apenas do framework.

### Estimativa recomendada

- Spike técnico com Tauri, tray, janela transparente e hotkey: 1 a 2 dias.
- MVP core sem calendário: 6 a 8 dias úteis.
- Release utilizável com calendário ICS, autostart, AppImage, `.deb` e QA: 8 a 12 dias úteis.
- Se o desenvolvedor ainda não tiver familiaridade com Rust: adicionar aproximadamente 2 a 3 dias de aprendizado e ajustes.
- Google Calendar ou Microsoft Graph: adicionar aproximadamente 2 a 4 dias por provider.

O app continua sendo pequeno. O prazo não é determinado pelo volume de regras de negócio, mas pelo acabamento de desktop integration, pela compatibilidade WebKitGTK e pelo comportamento da janela em X11 e Wayland.

## 3. Referência funcional usada

O app existente fornece a seguinte referência para a nova implementação:

- Tray com acesso a Tasks, iniciar/parar foco, Settings, update e quit.
- Widget compacto no topo durante uma sessão ativa.
- Contagem regressiva, tarefa ativa e progress timeline.
- Modo minimal, sem tempo e sem nome da tarefa.
- Timeline RGB opcional.
- Dashboard de hover com tarefas do dia e Activity.
- Lista de tarefas com criação, edição, conclusão, exclusão e reorder.
- Janela Tasks com calendário mensal, Day, Unscheduled e formulário inline.
- Detalhe de tarefa com título, notas, duração, data e ações de foco.
- Sessões de foco e heatmap do mês atual.
- Streak consecutivo.
- Settings de foco, notificações, som, aparência e launch at login.
- Atalho global para alternar o foco.
- Notificação local ao concluir um bloco.
- Calendário somente leitura.
- Checagem de novas versões.

### Divergência documentada sobre break timer

O README do app macOS menciona durações de break, mas o código atual não implementa uma fase de break nem uma configuração correspondente. Este PRD não inclui break timer no escopo inicial. Se o break for obrigatório para o produto novo, ele deve ser especificado antes do desenvolvimento e acrescentará esforço ao timer, à UI e aos testes.

## 4. Objetivos e não objetivos

### 4.1 Objetivos

- Criar um app Linux local-first para uso pessoal no Ubuntu.
- Reproduzir o fluxo rápido de começar e controlar um foco.
- Manter a interface escura, compacta e visualmente próxima da referência.
- Permitir que o app permaneça ativo em tray sem uma janela normal aberta.
- Guardar tarefas, sessões e configurações localmente.
- Ter um widget superior útil, mesmo sem um notch físico.
- Usar Rust apenas onde ele agrega segurança, persistência ou integração com o sistema.
- Distribuir o resultado como AppImage e pacote Debian.

### 4.2 Não objetivos da primeira versão

- Reproduzir o hardware ou a safe area física do MacBook.
- Compartilhar código com `DailyNotch/`.
- Ler ou migrar o arquivo de dados do app macOS.
- Criar backend, login ou sincronização de tarefas.
- Escrever eventos no calendário.
- Suportar todas as distribuições Linux.
- Criar uma extensão GNOME ou integração específica para cada compositor.
- Implementar Google Calendar e Microsoft Calendar na primeira entrega.
- Implementar break timer sem decisão explícita.

## 5. Usuário e fluxo principal

### 5.1 Usuário alvo

Pessoa que trabalha no Ubuntu, mantém uma lista pequena de tarefas e quer iniciar um bloco de foco sem abrir um aplicativo grande ou trocar de contexto.

### 5.2 Fluxo principal

1. O app inicia em segundo plano, cria o tray e não abre uma janela normal.
2. O usuário aciona `Ctrl+Shift+Space` ou escolhe Start focus na tray.
3. O app seleciona a primeira tarefa não concluída de hoje ou inicia um bloco sem tarefa.
4. O widget superior aparece com tempo, tarefa e progresso.
5. O usuário passa o mouse no widget para abrir o dashboard.
6. O usuário pausa, retoma, conclui uma tarefa ou abre Tasks.
7. Ao fim do bloco, o app grava a sessão, atualiza Activity e envia uma notificação.
8. O usuário continua trabalhando pela tray ou fecha qualquer janela sem encerrar o processo.

## 6. Adaptação da UI para Linux

### 6.1 Widget superior

O Linux não possui a geometria de notch usada pelo app macOS. A nova UI terá um widget flutuante centralizado horizontalmente no display primário.

Comportamento padrão:

- Janela sem decorações, com fundo transparente fora da pill.
- Posicionamento no centro horizontal.
- Preferência por ficar abaixo da área ocupada pelo painel do desktop.
- Invisível quando não há sessão ativa.
- Visível e compacto quando há sessão ativa.
- Expansão por hover para aproximadamente 620 px de largura.
- Recolhimento com atraso curto ao sair do pointer.
- Ações também disponíveis na tray e na Tasks window.

O widget deve ter um modo fallback. Se o compositor não permitir posicionamento, transparência ou always-on-top confiável, a aplicação não pode perder a capacidade de controlar o foco.

### 6.2 Display e monitores

Na primeira versão:

- Usar o display primário.
- Recalcular a posição quando as métricas de display mudarem, se a API permitir.
- Não manter uma instância do widget em cada monitor.
- Não seguir o cursor entre monitores.

Depois da primeira release, pode ser adicionado um setting para display preferido.

### 6.3 Design system

Recriar no CSS os tokens observados na referência:

- Pill preta.
- Painel escuro em torno de `#1a1a1a`.
- Hover em torno de `#292929`.
- Texto principal branco.
- Texto secundário em cinza.
- Accent azul consistente.
- Estado de pausa em vermelho.
- Cantos arredondados de 12 a 22 px.
- Stroke fino na timeline.
- Glow opcional para timeline RGB.

SF Symbols não estão disponíveis no Linux. Usar SVGs próprios ou uma biblioteca de ícones pequena, mantendo a mesma semântica visual.

### 6.4 WebKitGTK

Tauri usa o webview nativo do sistema. No Linux isso significa WebKitGTK, não Chromium embutido.

Consequências para a UI:

- Usar CSS e APIs web amplamente suportadas pelo WebKitGTK alvo.
- Evitar depender de comportamentos exclusivos de Chromium.
- Testar animações, `backdrop-filter`, fontes, scroll, drag e inputs no Ubuntu real.
- Fixar uma baseline de WebKitGTK para build e QA.
- Revalidar a UI quando o Ubuntu atualizar o WebKitGTK do sistema.

## 7. Escopo funcional

### 7.1 Lifecycle e single instance

- O app deve iniciar uma única instância.
- Abrir o executável novamente deve focar ou abrir a instância já existente.
- Fechar Tasks e Settings não encerra o processo.
- Quit encerra o processo e libera hotkeys e recursos.
- O app deve funcionar sem terminal aberto.

Usar o plugin oficial `tauri-plugin-single-instance`. A inicialização do plugin precisa acontecer cedo, antes dos demais plugins que dependem do lifecycle.

### 7.2 System tray

- Criar tray com `tray-icon` do Tauri.
- Exibir menu com Open Tasks, Start/Stop focus, Settings, About/Update e Quit.
- Atualizar o label de Start/Stop conforme o estado do timer.
- Usar um menu real também em Linux, pois a visibilidade do ícone pode depender de um menu configurado.
- Priorizar o menu contextual, especialmente porque alguns eventos de clique de tray variam entre desktops Linux.
- Nunca depender exclusivamente de clique esquerdo no ícone.

### 7.3 Overlay de foco

- Estado idle: widget oculto ou sem conteúdo visual.
- Estado running: contagem, tarefa ativa e timeline.
- Estado paused: estado visual de pausa e controle de retomada.
- Dashboard expandido: To Do, Activity e atalhos para Tasks.
- Modo minimal: ocultar contagem e título.
- Timeline desligável.
- Timeline RGB opcional.
- Popover de duração deve manter o dashboard aberto enquanto estiver em uso.
- O widget não deve ficar sob uma janela comum quando o ambiente permitir always-on-top.

### 7.4 Tarefas

Campos:

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
```

Requisitos:

- Criar tarefa para um dia ou sem data.
- Editar título, notas, duração, data e status.
- Limitar título a 150 caracteres.
- Limitar notas a 500 caracteres.
- Iniciar, pausar e retomar foco pela lista.
- Excluir tarefa.
- Mostrar concluídas no fim da lista.
- Reordenar por drag handle.
- Abrir detalhe de tarefa a partir do widget.
- Não sincronizar tarefas com nenhum serviço externo.

### 7.5 Tasks window

- Janela normal com tema escuro.
- Calendário mensal com navegação anterior e próxima.
- Seleção de dia e botão Today.
- Tabs Day e Unscheduled.
- Lista com scroll.
- Reorder consistente com o widget.
- Formulário inline de nova tarefa.
- Modal de detalhe com start, save, delete e completed.
- Settings acessível pelo cabeçalho.

### 7.6 Focus engine em Rust

Estados:

```text
idle -> running -> paused -> running
running -> idle       ao completar
paused -> idle        ao parar
running/paused -> idle ao concluir ou excluir a tarefa ativa
```

Requisitos:

- O foco de uma tarefa usa `estimateMinutes`.
- O foco sem tarefa usa a duração padrão configurada.
- Pause preserva o tempo já transcorrido.
- Stop grava uma sessão abortada quando aplicável.
- Complete grava uma sessão concluída.
- Complete soma o tempo à tarefa ativa quando houver uma.
- Concluir ou excluir a tarefa ativa encerra o foco associado.
- A fonte de verdade é um timestamp de início, fim e pausa, não o número de ticks.
- O timer deve continuar correto depois de lock/unlock, suspend/resume e throttling do webview.

Implementação recomendada:

- Estado do timer mantido no Rust.
- `end_at` armazenado como timestamp Unix em milissegundos.
- Atualizações de tela emitidas por eventos Tauri.
- Uma tarefa assíncrona ou thread controlada acorda para concluir o bloco.
- Ao acordar, comparar o relógio atual com `end_at` antes de concluir.
- Cancelar e recriar o scheduler em pause, resume, stop e start de outra sessão.

### 7.7 Activity e streak

- Contar sessões por dia no timezone local.
- Heatmap do mês atual.
- Grade Monday-first.
- Intensidade proporcional ao número de sessões.
- Dias futuros e fora do mês ficam vazios.
- Streak termina hoje ou ontem.
- Manter, como comportamento inicial, o mesmo critério da referência: qualquer sessão registrada conta para Activity.

### 7.8 Settings

- Duração padrão de foco entre 1 e 180 minutos.
- Notificação ao concluir bloco.
- Som ao concluir bloco.
- Mostrar timeline.
- Timeline RGB.
- Modo minimal.
- Launch at login.
- Diagnóstico do hotkey global.
- Fonte do calendário ICS, se habilitada.

### 7.9 Notificações e som

- Usar `tauri-plugin-notification` para notificação nativa.
- Solicitar ou verificar permissão quando necessário.
- Mostrar `Focus block complete` e o título da tarefa.
- Respeitar o setting de notificações.
- Tocar um asset de som curto ou usar uma solução Rust compatível com Linux.
- Se o desktop não tiver backend de notificação ou áudio disponível, não interromper a sessão nem gerar erro fatal.

### 7.10 Atalho global

- Atalho padrão: `Ctrl+Shift+Space`.
- Usar `tauri-plugin-global-shortcut`.
- Registrar e desregistrar de forma idempotente.
- Informar na UI quando a combinação estiver ocupada ou não puder ser registrada.
- Manter Start/Stop na tray e no widget como fallback.
- Permitir configuração de outra combinação em uma etapa posterior.

### 7.11 Calendário

O app novo não terá EventKit. A primeira implementação deve usar um provider isolado:

- Arquivo `.ics` local ou URL `.ics`.
- Leitura somente leitura.
- Eventos filtrados pelo dia selecionado.
- Ordenação por início.
- Estados de não configurado, erro, sem eventos e carregado.
- Atualização ao abrir Tasks e em intervalo moderado.
- Sem escrita no calendário.

OAuth para Google ou Microsoft fica fora do MVP e deve ser implementado atrás de uma interface `CalendarProvider`.

### 7.12 Autostart

Usar `tauri-plugin-autostart`, que possui suporte Linux. O comportamento esperado é:

- Enable cria ou ativa o autostart do usuário.
- Disable remove ou desativa o autostart.
- O app inicia minimizado para tray/widget.
- O estado exibido em Settings reflete o estado real.
- O fluxo é testado em `.deb` e AppImage.

Se a integração automática não funcionar em algum formato de distribuição, implementar um adaptador Linux explícito baseado em `.desktop` e documentar a diferença.

### 7.13 Update checker

Para manter o primeiro release simples:

- Consultar GitHub Releases a cada seis horas no máximo.
- Comparar versões SemVer.
- Mostrar update disponível no menu da tray.
- Abrir a release no browser padrão.
- Não bloquear o app em caso de offline.

Atualização automática pode usar `tauri-plugin-updater` em uma etapa posterior. No Linux, o fluxo de update deve ser definido por formato de distribuição, priorizando AppImage.

## 8. Arquitetura técnica

### 8.1 Estrutura proposta

Criar o novo app em `tauri/`, sem alterar os arquivos do app macOS:

```text
tauri/
|- package.json
|- package-lock.json
|- vite.config.ts
|- tsconfig.json
|- index.html
|- src/
|  |- main.tsx
|  |- app/
|  |- components/
|  |- features/
|  |  |- overlay/
|  |  |- tasks/
|  |  |- activity/
|  |  |- settings/
|  |  |- calendar/
|  |- icons/
|  |- styles/
|- src-tauri/
|  |- Cargo.toml
|  |- tauri.conf.json
|  |- capabilities/
|  |  |- default.json
|  |- icons/
|  |- src/
|     |- lib.rs
|     |- commands.rs
|     |- state.rs
|     |- timer.rs
|     |- domain/
|     |  |- task.rs
|     |  |- session.rs
|     |  |- settings.rs
|     |  |- streak.rs
|     |- storage/
|     |  |- repository.rs
|     |  |- schema.rs
|     |- integrations/
|        |- calendar.rs
|        |- notifications.rs
|        |- shortcuts.rs
|        |- autostart.rs
|- tests/
|  |- domain/
|  |- e2e/
|- assets/
```

### 8.2 Responsabilidades do React

- Renderizar overlay, Tasks, Settings e Activity.
- Controlar estado de apresentação e abertura de modais.
- Fazer validação imediata de campos para feedback visual.
- Invocar comandos Tauri por uma API pequena.
- Escutar eventos de mudança de store e timer.
- Executar animações e atualização visual da contagem.
- Não ser a fonte de verdade dos dados persistidos.

### 8.3 Responsabilidades do Rust

- Manter o estado global da aplicação.
- Persistir o payload local.
- Executar regras de tarefas, sessões e streak.
- Controlar o scheduler do timer.
- Criar tray e menu.
- Registrar hotkey global.
- Gerenciar notificações.
- Gerenciar autostart.
- Abrir URLs externas por comando restrito.
- Emitir eventos para as janelas React.

### 8.4 Comunicação

Usar comandos Tauri para operações e eventos Tauri para mudanças:

```text
get_snapshot()
add_task(input)
update_task(task)
delete_task(task_id)
toggle_task(task_id)
move_tasks(list, source, destination)
start_focus(task_id, duration_minutes)
pause_focus()
resume_focus()
stop_focus(record)
toggle_focus()
update_settings(partial_settings)
get_calendar_status()
refresh_calendar(date)
configure_calendar(source)
set_autostart(enabled)
open_external(url)
```

Eventos:

```text
store-changed
focus-changed
settings-changed
calendar-changed
shortcut-changed
```

### 8.5 Capabilities e segurança

Tauri 2 bloqueia por padrão comandos potencialmente perigosos. Cada janela deve receber somente as permissões necessárias.

Regras:

- `contextIsolation` e controles equivalentes devem permanecer habilitados.
- Não expor filesystem amplo ao React.
- Não expor execução arbitrária de comandos.
- Restringir abertura de URL a `https` e aos destinos necessários.
- Preferir comandos Rust específicos a permissões genéricas.
- Separar capabilities de overlay, Tasks e Settings quando isso reduzir acesso.
- Validar IDs, datas, durações e strings no Rust mesmo que o React já valide.
- Não guardar tokens de OAuth no localStorage caso providers externos sejam adicionados.

## 9. Modelo de dados novo

### 9.1 Payload inicial

O app começa vazio e não lê dados do macOS. Ainda assim, o formato próprio deve ser versionado para permitir evolução futura:

```rust
struct PersistedPayload {
    schema_version: u32,
    tasks: Vec<Task>,
    sessions: Vec<FocusSession>,
    settings: FocusSettings,
}
```

### 9.2 Localização

Usar os diretórios de dados do Tauri no Linux, preferencialmente por meio de `app_data_dir` ou da API de path equivalente, resultando em uma localização sob o perfil do usuário, e não no diretório de instalação.

O caminho exato deve ser exposto em uma tela de diagnóstico ou documentado no README após o scaffold, sem hardcode de `/home/<usuario>`.

### 9.3 Persistência

- Repository escrito em Rust usando `serde`.
- Escrita atômica com arquivo temporário e rename.
- Backup antes de mudanças de schema futuras.
- Recuperação segura para JSON inválido sem apagar o original.
- Salvamento após cada mutação relevante ou com debounce curto.
- Um único writer para evitar concorrência entre janelas.
- Logs locais apenas para erros técnicos, sem telemetria.

Não criar uma migração do formato Swift. O `schema_version` existe somente para o ciclo de vida do novo app Tauri.

## 10. Distribuição e ambiente de desenvolvimento

### 10.1 Dependências de desenvolvimento

O desenvolvimento Linux exige Node, Rust e dependências de sistema do Tauri, incluindo WebKitGTK 4.1, bibliotecas de build, AppIndicator e SVG.

A baseline recomendada para build é Ubuntu 22.04 x64, por ser uma base compatível documentada para WebKitGTK 4.1. A aplicação deve ser validada também na versão Ubuntu LTS que será anunciada como alvo de uso.

### 10.2 Artefatos

Primeiro release:

- AppImage para download direto e teste rápido.
- `.deb` como caminho recomendado para Ubuntu instalado.
- Desktop entry e ícones em tamanhos Linux adequados.
- Assinatura de artefatos como melhoria posterior, se o projeto publicar releases frequentes.

Não adicionar Snap ou Flatpak no primeiro ciclo, pois eles acrescentam permissões de sandbox, integração de tray e single-instance que não são necessárias para validar o produto.

### 10.3 CI

Criar workflow separado para o app novo, sem alterar a CI do macOS:

- Build frontend.
- Testes TypeScript.
- Testes Rust.
- `cargo tauri build` em Ubuntu 22.04 x64.
- Upload dos artefatos AppImage e `.deb` em releases.
- Cache de Node e Cargo.
- Smoke test de que os arquivos de bundle existem.

O build deve ocorrer na versão mais antiga que o produto pretende suportar, pois bibliotecas como glibc podem limitar a execução em sistemas mais antigos quando o binário é compilado em uma base nova.

## 11. Avaliação de dificuldade

### 11.1 Classificação

Nível geral: médio.

Não é um projeto grande em regras de negócio. É um projeto de dificuldade média por envolver uma UI com várias superfícies e comportamento de desktop que não existe em um site comum.

### 11.2 O que é fácil

- Componentes React da Tasks window.
- Calendário mensal.
- Lista, formulário, modal e settings.
- Heatmap e cálculo visual de Activity.
- Tokens de cor e layout.
- Modelo de tarefa e sessões.
- Persistência local em JSON.
- Notificação simples.

### 11.3 O que é médio

- Estado global entre várias janelas.
- IPC React para Rust.
- Timer correto em segundo plano.
- Drag-to-reorder consistente.
- Tray com menu dinâmico.
- Autostart em pacotes diferentes.
- Build reproducível com Rust e WebKitGTK.

### 11.4 O que é difícil ou incerto

- Overlay transparente, centralizado e always-on-top em Wayland.
- Comportamento de foco e z-order em diferentes window managers.
- Diferenças de WebKitGTK entre versões do Ubuntu.
- Ícone e eventos do tray em GNOME sem extensão de tray.
- Calendário externo se houver exigência de OAuth.
- Som e notificações em ambientes Linux incompletos.

### 11.5 Efeito de não reutilizar o app existente

Não fazer migração nem reaproveitar lógica reduz o risco de acoplamento e torna a arquitetura mais limpa. Em contrapartida:

- O domínio será escrito novamente em Rust.
- A UI será escrita novamente em React.
- O comportamento deve ser conferido manualmente contra a referência.
- Não haverá economia de tempo por conversão automática de modelos.

Mesmo assim, a referência visual e funcional reduz bastante o trabalho de decisão de produto. Não é necessário descobrir a interface do zero.

## 12. Estimativa de esforço

| Fase | Entrega | Estimativa |
| --- | --- | ---: |
| Spike Tauri | Scaffold, build, janela transparente, tray e hotkey | 1 a 2 dias |
| Fundação | Rust state, comandos, React shell e capabilities | 1 a 1,5 dia |
| Domínio | Task, session, settings, repository, timer e streak | 1,5 a 2 dias |
| UI principal | Widget, dashboard, Tasks, modal e settings | 2,5 a 3,5 dias |
| Integrações | Tray dinâmico, notificações, som, autostart e update | 1 a 1,5 dia |
| Calendário | Provider ICS read-only | 0,5 a 1 dia |
| QA e release | X11, Wayland, AppImage, `.deb`, lock/suspend e polish | 1,5 a 2,5 dias |
| **Total recomendado** | **Release Linux nova com escopo definido** | **8 a 12 dias úteis** |

### Pacotes de escopo

- Protótipo demonstrável: 2 a 3 dias.
- MVP core sem calendário e sem polish de distribuição: 6 a 8 dias úteis.
- Release recomendada com ICS e dois formatos de pacote: 8 a 12 dias úteis.
- Release com Google ou Microsoft Calendar: 10 a 16 dias úteis.
- Release com suporte avançado a Wayland, múltiplos monitores e vários desktops: 12 a 18 dias úteis ou mais.

### Ajuste por experiência

- Experiência forte em React e Rust: estimativa base.
- Experiência forte em React, mas Rust novo: adicionar 2 a 3 dias.
- Experiência forte em Rust, mas React novo: adicionar 1 a 2 dias.
- Sem ambiente Ubuntu para teste: adicionar tempo de setup e uma rodada de QA, sem reduzir a estimativa de implementação.

## 13. Plano de execução

### Fase 0 - prova de risco, 1 a 2 dias

- Criar o projeto Tauri com React.
- Instalar dependências Linux.
- Compilar uma janela simples.
- Criar janela sem decoração e transparente.
- Posicionar no topo central no Ubuntu real.
- Testar X11 e Wayland.
- Criar tray com menu.
- Registrar `Ctrl+Shift+Space`.
- Testar autostart.

Gate de decisão:

- Se o overlay funcionar bem, manter o widget como superfície principal.
- Se Wayland limitar o overlay, declarar tray e Tasks como fallback oficial antes de seguir com o polish.
- Se a limitação for inaceitável, avaliar um adaptador nativo com layer-shell como escopo adicional.

### Fase 1 - fundação, 1 a 1,5 dia

- Definir `tauri.conf.json`, identifier, ícones e capabilities.
- Configurar React, TypeScript, lint e testes.
- Configurar Rust, `serde` e erros de domínio.
- Implementar single-instance.
- Criar estado global e eventos.
- Criar repository local.

### Fase 2 - domínio, 1,5 a 2 dias

- Implementar tarefas e regras de ordenação.
- Implementar sessões.
- Implementar timer orientado por timestamps.
- Implementar streak e Activity.
- Implementar settings.
- Cobrir regras com testes Rust.

### Fase 3 - UI, 2,5 a 3,5 dias

- Implementar design tokens.
- Implementar widget recolhido.
- Implementar dashboard expandido.
- Implementar To Do e Activity.
- Implementar Tasks window.
- Implementar calendário mensal.
- Implementar detalhe, reorder e add form.
- Implementar Settings.

### Fase 4 - integrações, 1 a 2 dias

- Integrar tray e ações.
- Integrar hotkey.
- Integrar notificações e som.
- Integrar autostart.
- Integrar update checker.
- Integrar ICS se incluído no release.

### Fase 5 - release, 1,5 a 2,5 dias

- Gerar AppImage e `.deb`.
- Testar instalação e remoção.
- Testar upgrade sem perder dados do novo app.
- Testar lock/unlock e suspend/resume.
- Testar escalas HiDPI.
- Testar display externo.
- Testar X11 e Wayland.
- Corrigir regressões e documentar limitações.

## 14. Critérios de aceite

### Produto novo e isolamento

- [ ] O app novo está em `tauri/` ou em uma pasta própria equivalente.
- [ ] O build não importa código de `DailyNotch/`.
- [ ] O app não tenta localizar ou ler dados do macOS.
- [ ] O app inicia com banco ou JSON vazio no primeiro uso.
- [ ] O app macOS continua compilável sem depender do novo app.

### Lifecycle e tray

- [ ] Apenas uma instância fica ativa.
- [ ] Tasks e Settings podem ser abertas e fechadas sem encerrar tray ou timer.
- [ ] O menu da tray atualiza Start/Stop conforme o timer.
- [ ] Quit encerra o processo e remove recursos globais.
- [ ] O ícone aparece no ambiente Ubuntu alvo ou a limitação é documentada.

### Widget e foco

- [ ] A pill ativa aparece no topo central do display primário.
- [ ] A pill não cobre o painel superior por padrão.
- [ ] Hover expande e recolhe de forma estável.
- [ ] Start, pause, resume e stop funcionam.
- [ ] Timeline e modo minimal respeitam os settings.
- [ ] O tempo continua correto após o webview ficar em segundo plano.
- [ ] O tempo continua correto após lock/unlock e suspend/resume.
- [ ] O fallback pela tray e Tasks funciona quando o overlay não puder ficar no topo.

### Tarefas

- [ ] Criar tarefa funciona com e sem data.
- [ ] Editar título, notas, data, duração e conclusão funciona.
- [ ] Excluir tarefa funciona.
- [ ] Tarefas concluídas descem para o final.
- [ ] Reorder funciona pelo drag handle.
- [ ] Day e Unscheduled exibem os itens corretos.
- [ ] A nova tarefa usa o default de foco configurado.

### Activity e dados

- [ ] Complete e stop gravam sessões conforme especificado.
- [ ] O tempo focado da tarefa é atualizado.
- [ ] Heatmap e streak refletem as sessões.
- [ ] Os dados sobrevivem ao restart do app.
- [ ] JSON inválido não apaga silenciosamente o arquivo original.
- [ ] Existe `schema_version` para evoluções futuras do novo app.

### Integrações

- [ ] Hotkey é registrado ou sua falha é exibida ao usuário.
- [ ] Notificação de conclusão funciona quando habilitada.
- [ ] Som respeita o setting.
- [ ] Autostart pode ser ligado e desligado.
- [ ] ICS mostra eventos do dia e não os modifica.
- [ ] Falha no update checker não impede o uso offline.

### Distribuição

- [ ] CI Linux compila frontend e Rust.
- [ ] AppImage é gerado.
- [ ] `.deb` é gerado.
- [ ] Desktop entry e ícones são instalados.
- [ ] O app inicia em uma Ubuntu limpa dentro da baseline anunciada.
- [ ] README documenta requisitos, instalação, limitações Wayland e localização dos dados.

## 15. Riscos e mitigação

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Overlay sem always-on-top ou posição confiável em Wayland | alto | Spike no início, fallback oficial por tray e Tasks, suporte avançado separado |
| Dependência de WebKitGTK do sistema | alto | Fixar baseline, build na base mais antiga suportada e QA no Ubuntu alvo |
| CSS ou comportamento diferente entre WebKitGTK e browsers atuais | médio | Usar CSS conservador e testar no webview real desde a primeira semana |
| Tray ausente ou inconsistente no GNOME | médio | Menu equivalente em Tasks, ações também no hotkey e widget |
| Hotkey ocupado ou indisponível | médio | Exibir status, permitir troca futura e preservar controles visíveis |
| AppImage e autostart com caminho variável | médio | Testar formato real; priorizar `.deb` como instalação recomendada |
| Rust aumenta o tempo de setup | médio | Manter backend pequeno, usar comandos coesos e plugins oficiais |
| Notificações ou som não disponíveis | baixo-médio | Não bloquear timer; indicar o estado e permitir continuar sem alerta |
| ICS possui variações de formato | médio | Usar parser testado, limitar o provider inicial e exibir erro recuperável |
| Bundle AppImage fica maior do que o esperado | baixo-médio | Medir artefatos e manter `.deb` como opção de instalação |
| Mudança de schema do novo app | médio | Versionar payload desde o primeiro commit; isso não é migração macOS |

## 16. Comparação final: Tauri versus Electron

| Critério | Tauri + React + Rust | Electron + React + TypeScript |
| --- | --- | --- |
| UI React | mesmo esforço | mesmo esforço |
| Backend local | mais seguro e tipado, mas exige Rust | mais simples em TypeScript |
| Setup inicial | maior por Rust, WebKitGTK e capabilities | menor, especialmente para quem já conhece Node |
| Tamanho do app | normalmente menor, pois usa webview do sistema | maior, pois inclui Chromium |
| Previsibilidade visual | depende da versão do WebKitGTK | mais uniforme com Chromium embutido |
| Tray, hotkey e autostart | cobertos por APIs/plugins Tauri | cobertos pelas APIs do Electron ou módulos auxiliares |
| Linux packaging | AppImage e `.deb`, com atenção a WebKitGTK/glibc | AppImage e `.deb`, com bundle mais pesado |
| Overlay Wayland | risco de compositor/window manager | risco de compositor/window manager |
| Perfil recomendado | app pequeno, leve, com backend Rust enxuto | desenvolvimento mais rápido e stack única JS |

### Recomendação

Para este caso, Tauri é uma escolha razoável e provavelmente melhor se o objetivo principal for um app Linux leve, com Rust mantendo o timer e o estado local. A diferença de prazo para Electron não será enorme, mas Tauri exige uma primeira fase de prova de risco mais importante.

Se o desenvolvedor não conhece Rust e a prioridade absoluta for colocar algo funcionando rapidamente, Electron tem menor custo inicial. Se a prioridade for tamanho, consumo e uma base nativa mais restrita, Tauri compensa o setup adicional.

## 17. Decisões recomendadas para iniciar

1. Criar o app em `tauri/` como produto independente.
2. Usar React + TypeScript somente na UI.
3. Usar Rust como fonte de verdade do estado, timer e persistência.
4. Começar pelo widget superior, tray e hotkey como spike.
5. Suportar display primário primeiro.
6. Usar `tauri-plugin-single-instance`, `global-shortcut`, `notification` e `autostart`.
7. Usar JSON próprio versionado, iniciado vazio, sem migração macOS.
8. Implementar ICS read-only antes de OAuth.
9. Publicar AppImage e `.deb`.
10. Tratar Wayland como cenário de QA obrigatório e fallback oficial, não como detalhe posterior.

## 18. Referências técnicas

As versões das dependências devem ser fixadas no início do desenvolvimento e comparadas com a documentação correspondente:

- [Tauri - criação de projetos](https://v2.tauri.app/start/create-project/)
- [Tauri - pré-requisitos Linux](https://v2.tauri.app/start/prerequisites/)
- [Tauri - distribuição](https://v2.tauri.app/distribute/)
- [Tauri - AppImage e baseline de build](https://v2.tauri.app/distribute/appimage/)
- [Tauri - system tray](https://v2.tauri.app/learn/system-tray/)
- [Tauri - global shortcut](https://v2.tauri.app/plugin/global-shortcut/)
- [Tauri - notifications](https://v2.tauri.app/plugin/notification/)
- [Tauri - autostart](https://v2.tauri.app/plugin/autostart/)
- [Tauri - single instance](https://v2.tauri.app/plugin/single-instance/)
- [Tauri - store](https://v2.tauri.app/plugin/store/)
- [Tauri - updater](https://v2.tauri.app/plugin/updater/)
- [Tauri - webview versions](https://tauri.app/reference/webview-versions/)

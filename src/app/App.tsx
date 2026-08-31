import { useEffect, useState } from "react"

import { Panel } from "../components/Panel"
import { Button } from "../components/ui/button"

import {
  desktopApi,
  normalizeDesktopApiError,
  type AppSnapshot,
  type DesktopApi,
  type DesktopApiError,
  type SurfaceLabel,
} from "../lib/desktopApi"

type AppProps = {
  api?: DesktopApi
  surface?: SurfaceLabel
}

type ShellState =
  | { status: "loading" }
  | { status: "ready"; snapshot: AppSnapshot }
  | { status: "error"; error: DesktopApiError }

type AppShellProps = {
  snapshot: AppSnapshot
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function SnapshotSummary({ snapshot }: AppShellProps) {
  return (
    <>
      <dl className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
        <Panel className="gap-2 px-5 py-5">
          <dt className="text-caption font-medium text-muted">Tarefas</dt>
          <dd className="mt-2 text-title font-semibold text-content">
            {countLabel(snapshot.tasks.length, "tarefa", "tarefas")}
          </dd>
        </Panel>
        <Panel className="gap-2 px-5 py-5">
          <dt className="text-caption font-medium text-muted">Sessões</dt>
          <dd className="mt-2 text-title font-semibold text-content">
            {countLabel(snapshot.sessions.length, "sessão", "sessões")}
          </dd>
        </Panel>
        <Panel className="gap-2 px-5 py-5">
          <dt className="text-caption font-medium text-muted">Foco</dt>
          <dd className="mt-2 text-title font-semibold capitalize text-content">
            {snapshot.focus.state}
          </dd>
        </Panel>
      </dl>

      {snapshot.tasks.length === 0 && (
        <p className="mt-6 text-body text-muted">Nenhuma tarefa ainda.</p>
      )}
    </>
  )
}

export function AppShell({ snapshot }: AppShellProps) {
  return (
    <main
      className="min-h-screen px-6 py-12 text-content sm:px-10"
      data-surface="overlay"
    >
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-4xl flex-col justify-center">
        <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-pill border border-accent/20 bg-accent/10 px-3 py-1 text-caption text-accent">
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          Contrato desktop conectado
        </div>

        <p className="mb-4 text-caption font-medium uppercase tracking-[0.24em] text-muted">
          DailyNotch Linux
        </p>
        <h1 className="max-w-3xl text-display font-semibold text-content sm:text-display-lg">
          Seu espaço de foco está pronto.
        </h1>
        <p className="mt-6 max-w-2xl text-body text-muted">
          O shell compartilha o mesmo snapshot entre o navegador e o app
          desktop. As superfícies de tarefas e foco serão adicionadas nas
          próximas etapas.
        </p>

        <SnapshotSummary snapshot={snapshot} />
      </section>
    </main>
  )
}

type PlaceholderSurface = Exclude<SurfaceLabel, "overlay">

type SurfacePlaceholderProps = {
  surface: PlaceholderSurface
  snapshot: AppSnapshot
}

const surfaceTitles: Record<PlaceholderSurface, string> = {
  tasks: "Tasks",
  settings: "Settings",
}

function SurfacePlaceholder({
  surface,
  snapshot,
}: SurfacePlaceholderProps) {
  return (
    <main
      className="min-h-screen bg-canvas px-6 py-12 text-content sm:px-10"
      data-surface={surface}
    >
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl flex-col justify-center">
        <p className="mb-4 text-caption font-medium uppercase tracking-[0.24em] text-muted">
          DailyNotch Linux
        </p>
        <h1 className="text-display font-semibold text-content sm:text-display-lg">
          {surfaceTitles[surface]}
        </h1>
        <p className="mt-6 max-w-2xl text-body text-muted">
          Esta superfície está conectada ao snapshot compartilhado do desktop.
        </p>

        <SnapshotSummary snapshot={snapshot} />
      </section>
    </main>
  )
}

type LoadingShellProps = {
  surface: SurfaceLabel
}

function LoadingShell({ surface }: LoadingShellProps) {
  const backgroundClass = surface === "overlay" ? "bg-transparent" : "bg-canvas"

  return (
    <main
      className={`flex min-h-screen items-center justify-center px-6 text-content ${backgroundClass}`}
      data-surface={surface}
    >
      <p className="text-body text-muted" role="status">
        Carregando o DailyNotch…
      </p>
    </main>
  )
}

type ErrorShellProps = {
  error: DesktopApiError
  onRetry: () => void
  surface: SurfaceLabel
}

function ErrorShell({ error, onRetry, surface }: ErrorShellProps) {
  const backgroundClass = surface === "overlay" ? "bg-transparent" : "bg-canvas"

  return (
    <main
      className={`flex min-h-screen items-center justify-center px-6 text-content ${backgroundClass}`}
      data-surface={surface}
    >
      <Panel className="max-w-lg p-8" variant="danger">
        <p className="text-caption font-medium uppercase tracking-[0.2em] text-danger">
          DailyNotch Linux
        </p>
        <h1 className="mt-4 text-title font-semibold text-content">
          Não foi possível carregar o estado.
        </h1>
        <p className="mt-4 text-body text-muted" role="alert">
          A integração desktop está temporariamente indisponível. Código:{" "}
          <code className="font-mono text-danger">{error.code}</code>.
        </p>
        <Button
          className="mt-6"
          onClick={onRetry}
          type="button"
        >
          Tentar novamente
        </Button>
      </Panel>
    </main>
  )
}

function renderSurface(surface: SurfaceLabel, snapshot: AppSnapshot) {
  if (surface === "overlay") {
    return <AppShell snapshot={snapshot} />
  }

  return <SurfacePlaceholder snapshot={snapshot} surface={surface} />
}

export function App({ api = desktopApi, surface = "overlay" }: AppProps) {
  const [reloadKey, setReloadKey] = useState(0)
  const [shellState, setShellState] = useState<ShellState>({
    status: "loading",
  })

  useEffect(() => {
    let active = true
    setShellState({ status: "loading" })

    api.getSnapshot().then(
      (snapshot) => {
        if (active) {
          setShellState({ status: "ready", snapshot })
        }
      },
      (error: unknown) => {
        if (active) {
          setShellState({
            status: "error",
            error: normalizeDesktopApiError(error, "getSnapshot"),
          })
        }
      },
    )

    return () => {
      active = false
    }
  }, [api, reloadKey])

  if (shellState.status === "loading") {
    return <LoadingShell surface={surface} />
  }

  if (shellState.status === "error") {
    return (
      <ErrorShell
        error={shellState.error}
        onRetry={() => setReloadKey((currentKey) => currentKey + 1)}
        surface={surface}
      />
    )
  }

  return renderSurface(surface, shellState.snapshot)
}

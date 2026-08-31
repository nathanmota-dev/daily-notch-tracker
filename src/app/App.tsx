import { useEffect, useState } from "react"

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
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <dt className="text-sm text-zinc-500">Tarefas</dt>
          <dd className="mt-2 text-xl font-medium text-white">
            {countLabel(snapshot.tasks.length, "tarefa", "tarefas")}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <dt className="text-sm text-zinc-500">Sessões</dt>
          <dd className="mt-2 text-xl font-medium text-white">
            {countLabel(snapshot.sessions.length, "sessão", "sessões")}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <dt className="text-sm text-zinc-500">Foco</dt>
          <dd className="mt-2 text-xl font-medium capitalize text-white">
            {snapshot.focus.state}
          </dd>
        </div>
      </dl>

      {snapshot.tasks.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">Nenhuma tarefa ainda.</p>
      )}
    </>
  )
}

export function AppShell({ snapshot }: AppShellProps) {
  return (
    <main
      className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100 sm:px-10"
      data-surface="overlay"
    >
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-4xl flex-col justify-center">
        <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
          <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
          Contrato desktop conectado
        </div>

        <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
          DailyNotch Linux
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">
          Seu espaço de foco está pronto.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
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
      className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100 sm:px-10"
      data-surface={surface}
    >
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl flex-col justify-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
          DailyNotch Linux
        </p>
        <h1 className="text-5xl font-semibold tracking-tight text-white">
          {surfaceTitles[surface]}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
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
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100"
      data-surface={surface}
    >
      <p className="text-sm text-zinc-400" role="status">
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
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100"
      data-surface={surface}
    >
      <section className="max-w-lg rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-300">
          DailyNotch Linux
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          Não foi possível carregar o estado.
        </h1>
        <p className="mt-4 text-zinc-400" role="alert">
          A integração desktop está temporariamente indisponível. Código:{" "}
          <code>{error.code}</code>.
        </p>
        <button
          className="mt-6 rounded-xl bg-white px-4 py-2 font-medium text-zinc-950 transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-950"
          onClick={onRetry}
          type="button"
        >
          Tentar novamente
        </button>
      </section>
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

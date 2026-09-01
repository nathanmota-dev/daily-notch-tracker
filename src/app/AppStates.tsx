import type { AppSnapshot, DesktopApiError, SurfaceLabel } from "../lib/desktopApi"
import { Panel } from "../components/panel"
import { Button } from "../components/ui/button"

type PlaceholderSurface = "settings"

const surfaceTitles: Record<PlaceholderSurface, string> = {
  settings: "Settings",
}

function countLabel(count: number, singular: string, plural: string) {
  return count + " " + (count === 1 ? singular : plural)
}

function SnapshotSummary({ snapshot }: { snapshot: AppSnapshot }) {
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

export function SurfacePlaceholder({
  snapshot,
  surface,
}: {
  surface: PlaceholderSurface
  snapshot: AppSnapshot
}) {
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

export function LoadingShell({ surface }: { surface: SurfaceLabel }) {
  const backgroundClass = surface === "overlay" ? "bg-transparent" : "bg-canvas"

  return (
    <main
      className={
        "flex min-h-screen items-center justify-center px-6 text-content " +
        backgroundClass
      }
      data-surface={surface}
    >
      <p className="text-body text-muted" role="status">
        Carregando o DailyNotch…
      </p>
    </main>
  )
}

export function ErrorShell({
  error,
  onRetry,
  surface,
}: {
  error: DesktopApiError
  onRetry: () => void
  surface: SurfaceLabel
}) {
  const backgroundClass = surface === "overlay" ? "bg-transparent" : "bg-canvas"

  return (
    <main
      className={
        "flex min-h-screen items-center justify-center px-6 text-content " +
        backgroundClass
      }
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
        <Button className="mt-6" onClick={onRetry} type="button">
          Tentar novamente
        </Button>
      </Panel>
    </main>
  )
}

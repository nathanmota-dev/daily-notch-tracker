import type { DesktopApiError, SurfaceLabel } from "../lib/desktopApi"
import { Panel } from "../components/panel"
import { Button } from "../components/ui/button"

export function LoadingShell({ surface }: { surface: SurfaceLabel }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-transparent px-6 text-content"
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
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-transparent px-6 text-content"
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

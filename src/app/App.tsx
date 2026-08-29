import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

const starterFeatures = [
  "React + TypeScript",
  "Vite + Tailwind CSS",
  "Tauri 2 + Rust",
  "Vitest pronto para testes",
]

export function App() {
  const [status, setStatus] = useState<"idle" | "success" | "browser">("idle")

  async function checkRustBridge() {
    try {
      await invoke("greet", { name: "DailyNotch" })
      setStatus("success")
    } catch {
      setStatus("browser")
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100 sm:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl flex-col justify-center">
        <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-sm text-blue-200">
          <span className="size-2 rounded-full bg-blue-400" aria-hidden="true" />
          Tauri 2 + Rust
        </div>

        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
              DailyNotch Linux
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">
              Um foco de cada vez.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
              A fundação do app está pronta. O próximo passo é transformar essa
              superfície em um espaço rápido para tarefas e foco no Linux.
            </p>

            <button
              className="mt-8 rounded-xl bg-blue-500 px-5 py-3 font-medium text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-zinc-950"
              onClick={checkRustBridge}
              type="button"
            >
              {status === "success" ? "Rust conectado" : "Verificar a fundação"}
            </button>
            {status === "browser" && (
              <p className="mt-3 text-sm text-zinc-500">
                Frontend funcionando. Execute <code>npm run tauri:dev</code> para abrir o app desktop.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-blue-950/20">
            <p className="mb-5 text-sm font-medium text-zinc-300">
              Stack inicial
            </p>
            <ul className="space-y-3">
              {starterFeatures.map((feature) => (
                <li className="flex items-center gap-3 text-sm text-zinc-400" key={feature}>
                  <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300" aria-hidden="true">
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}

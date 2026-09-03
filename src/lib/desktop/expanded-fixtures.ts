import type { AppSnapshot, FocusSession, Task } from "./contracts"
import { createEmptyAppSnapshot } from "./base-snapshot"
import { getLocalDateString } from "../local-date"

export const EXPANDED_DASHBOARD_FIXTURE_NAMES = [
  "expanded",
  "expanded-empty",
  "expanded-one",
  "expanded-overflow",
  "expanded-completed",
  "expanded-long-title",
] as const

export type ExpandedDashboardFixture =
  (typeof EXPANDED_DASHBOARD_FIXTURE_NAMES)[number]

export function isExpandedDashboardFixture(
  value: unknown,
): value is ExpandedDashboardFixture {
  return (
    typeof value === "string" &&
    (EXPANDED_DASHBOARD_FIXTURE_NAMES as readonly string[]).includes(value)
  )
}

const LONG_TITLE =
  "Review and refine the complete DailyNotch Linux focus workflow before the next implementation milestone"

const TITLES = {
  first: "Plan the next focused block",
  second: "Review the desktop contract",
  third: "Prepare the release checklist",
  fourth: "Polish the empty state",
  fifth: "Document the next milestone",
  sixth: "Check the final visual details",
} as const

type NonEmptyExpandedFixture = Exclude<
  ExpandedDashboardFixture,
  "expanded-empty"
>

type ExpandedTaskSpec = {
  id: string
  title: string
  createdMinutesAgo: number
  estimateMinutes?: number
  focusedSeconds?: number
  isDone?: boolean
  notes?: string
  sortOrder: number
}

type ExpandedSessionSpec = {
  completed: boolean
  focusedSeconds: number
  id: string
  minutesAgo: number
}

const BASE_TASK_SPECS: ExpandedTaskSpec[] = [
  {
    id: "expanded-task-1",
    title: TITLES.first,
    createdMinutesAgo: 240,
    notes: "Set the top priority for today.",
    sortOrder: 0,
  },
  {
    id: "expanded-task-2",
    title: TITLES.second,
    createdMinutesAgo: 180,
    estimateMinutes: 50,
    notes: "Keep the boundary between UI and desktop code clear.",
    sortOrder: 1,
  },
]

const ACTIVITY_SESSION_SPECS: ExpandedSessionSpec[] = [
  {
    completed: true,
    focusedSeconds: 1_500,
    id: "expanded-session-today-first",
    minutesAgo: 1,
  },
  {
    completed: false,
    focusedSeconds: 900,
    id: "expanded-session-today-second",
    minutesAgo: 2,
  },
  {
    completed: true,
    focusedSeconds: 600,
    id: "expanded-session-today-third",
    minutesAgo: 3,
  },
  {
    completed: false,
    focusedSeconds: 300,
    id: "expanded-session-today-fourth",
    minutesAgo: 4,
  },
  {
    completed: true,
    focusedSeconds: 1_200,
    id: "expanded-session-yesterday",
    minutesAgo: 24 * 60 + 30,
  },
  {
    completed: true,
    focusedSeconds: 1_800,
    id: "expanded-session-two-days-ago",
    minutesAgo: 48 * 60 + 30,
  },
]

const TASK_SPECS: Record<NonEmptyExpandedFixture, ExpandedTaskSpec[]> = {
  expanded: BASE_TASK_SPECS,
  "expanded-one": [BASE_TASK_SPECS[0]],
  "expanded-overflow": [
    ...BASE_TASK_SPECS,
    {
      id: "expanded-task-3",
      title: TITLES.third,
      createdMinutesAgo: 120,
      estimateMinutes: 15,
      sortOrder: 2,
    },
    {
      id: "expanded-task-4",
      title: TITLES.fourth,
      createdMinutesAgo: 60,
      estimateMinutes: 30,
      sortOrder: 3,
    },
    {
      id: "expanded-task-5",
      title: TITLES.fifth,
      createdMinutesAgo: 30,
      estimateMinutes: 45,
      sortOrder: 4,
    },
    {
      id: "expanded-task-6",
      title: TITLES.sixth,
      createdMinutesAgo: 15,
      estimateMinutes: 20,
      sortOrder: 5,
    },
  ],
  "expanded-completed": [
    ...BASE_TASK_SPECS,
    {
      id: "expanded-task-3",
      title: "Ship the completed dashboard draft",
      createdMinutesAgo: 300,
      estimateMinutes: 45,
      focusedSeconds: 2_400,
      isDone: true,
      notes: "Finished in the previous focus block.",
      sortOrder: 0,
    },
  ],
  "expanded-long-title": [
    {
      id: "expanded-task-long-title",
      title: LONG_TITLE,
      createdMinutesAgo: 240,
      estimateMinutes: 50,
      notes: "The activity column keeps its fixed width.",
      sortOrder: 0,
    },
    {
      id: "expanded-task-2",
      title: TITLES.second,
      createdMinutesAgo: 180,
      sortOrder: 1,
    },
  ],
}

function fixtureTimestamp(milliseconds: number) {
  return new Date(milliseconds).toISOString()
}

function fixtureNow(milliseconds: number) {
  return Number.isFinite(milliseconds) ? milliseconds : Date.now()
}

function createExpandedTask(spec: ExpandedTaskSpec, now: number): Task {
  return {
    id: spec.id,
    title: spec.title,
    notes: spec.notes ?? "",
    scheduledDate: getLocalDateString(now),
    estimateMinutes: spec.estimateMinutes ?? 25,
    isDone: spec.isDone ?? false,
    createdAt: fixtureTimestamp(now - spec.createdMinutesAgo * 60 * 1000),
    focusedSeconds: spec.focusedSeconds ?? 0,
    sortOrder: spec.sortOrder,
  }
}

function createExpandedSession(
  spec: ExpandedSessionSpec,
  now: number,
): FocusSession {
  const startedAt = now - spec.minutesAgo * 60 * 1000

  return {
    id: spec.id,
    taskId: null,
    startedAt: fixtureTimestamp(startedAt),
    endedAt: fixtureTimestamp(startedAt + spec.focusedSeconds * 1000),
    focusedSeconds: spec.focusedSeconds,
    completed: spec.completed,
  }
}

export function createExpandedDashboardFixtureSnapshot(
  fixture: ExpandedDashboardFixture,
  now = Date.now(),
): AppSnapshot {
  const safeNow = fixtureNow(now)
  const snapshot = createEmptyAppSnapshot()
  snapshot.revision = 1

  if (fixture !== "expanded-empty") {
    snapshot.tasks = TASK_SPECS[fixture].map((spec) =>
      createExpandedTask(spec, safeNow),
    )
    snapshot.sessions = ACTIVITY_SESSION_SPECS.map((spec) =>
      createExpandedSession(spec, safeNow),
    )
  }

  return snapshot
}

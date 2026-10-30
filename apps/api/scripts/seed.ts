/**
 * A demo workspace with six weeks of believable history.
 *
 *   bun run db:seed
 *
 * Every write goes through the same repositories the api uses, with simulated timestamps, so the activity log,
 * sprint reports, notifications and outbox are exactly what real use would have produced — the burndown and
 * velocity charts are replays, not fixtures. Running it again does nothing if the demo workspace exists.
 */
import { hashPassword } from '@teamflow/auth';
import {
  completeSprint,
  createComment,
  createDatabase,
  createProject,
  createScope,
  createSprint,
  createTask,
  type Executor,
  findTask,
  moveTask,
  newId,
  type Scope,
  startSprint,
  updateTask,
} from '@teamflow/db';
import { accounts, labels, members, organizations, users } from '@teamflow/db/schema';
import type { Priority } from '@teamflow/domain';
import { eq, sql } from 'drizzle-orm';

const DEMO_EMAIL = 'demo@teamflow.dev';
const DEMO_PASSWORD = 'teamflow-demo';
const DAY = 86_400_000;

/** Deterministic randomness so every seed tells the same story. */
let state = 42;
const random = () => {
  state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
  return state / 2 ** 31;
};
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

const PEOPLE = [
  { name: 'Demo User', email: DEMO_EMAIL, role: 'owner' },
  { name: 'Maya Chen', email: 'maya@northwind.test', role: 'admin' },
  { name: 'Omar Haddad', email: 'omar@northwind.test', role: 'member' },
  { name: 'Priya Nair', email: 'priya@northwind.test', role: 'member' },
  { name: 'Lucas Moreau', email: 'lucas@northwind.test', role: 'member' },
  { name: 'Sofia Rossi', email: 'sofia@northwind.test', role: 'guest' },
] as const;

const BACKLOG: {
  title: string;
  description: string;
  estimate: number;
  priority: Priority;
  label?: string;
}[] = [
  {
    title: 'Calibrate wheel encoders',
    description: 'Encoder counts drift by ~2% after an hour of driving.',
    estimate: 3,
    priority: 'high',
    label: 'Hardware',
  },
  {
    title: 'Battery telemetry over CAN',
    description: 'Publish pack voltage, current and cell temperatures at 10 Hz.',
    estimate: 5,
    priority: 'high',
    label: 'Telemetry',
  },
  {
    title: 'Watchdog resets on brownout',
    description: 'The MCU resets when the pack sags under load.',
    estimate: 5,
    priority: 'urgent',
    label: 'Bug',
  },
  {
    title: 'Signed OTA updates',
    description: 'Verify the image signature before swapping banks.',
    estimate: 8,
    priority: 'high',
    label: 'Security',
  },
  {
    title: 'Lidar driver timeouts',
    description: 'Frames stall for 200 ms roughly once a minute.',
    estimate: 5,
    priority: 'medium',
    label: 'Bug',
  },
  {
    title: 'Motor controller PID tuning',
    description: 'Overshoot on the left drive at low speed.',
    estimate: 3,
    priority: 'medium',
    label: 'Hardware',
  },
  {
    title: 'Emergency stop latency budget',
    description: 'Measure and document end-to-end stop latency.',
    estimate: 2,
    priority: 'urgent',
  },
  {
    title: 'IMU fusion with wheel odometry',
    description: 'Complementary filter first, EKF later.',
    estimate: 8,
    priority: 'medium',
    label: 'Navigation',
  },
  {
    title: 'Log rotation on the SD card',
    description: 'Logs fill the card after three days.',
    estimate: 2,
    priority: 'low',
    label: 'Telemetry',
  },
  {
    title: 'Bootloader version in heartbeat',
    description: 'So the fleet console can show it.',
    estimate: 1,
    priority: 'low',
    label: 'Telemetry',
  },
  {
    title: 'Thermal throttling on the compute module',
    description: 'Throttle the planner before the SoC does.',
    estimate: 3,
    priority: 'medium',
    label: 'Hardware',
  },
  {
    title: 'Obstacle map memory leak',
    description: 'Heap grows by 4 MB an hour.',
    estimate: 5,
    priority: 'high',
    label: 'Bug',
  },
  {
    title: 'Dock alignment with AprilTags',
    description: 'Use the rear camera for the last 30 cm.',
    estimate: 8,
    priority: 'medium',
    label: 'Navigation',
  },
  {
    title: 'CAN bus error counters in telemetry',
    description: 'Expose TEC/REC so we can spot flaky harnesses.',
    estimate: 2,
    priority: 'low',
    label: 'Telemetry',
  },
  {
    title: 'Unit tests for the path smoother',
    description: 'Cover the corner cases from the field reports.',
    estimate: 3,
    priority: 'medium',
    label: 'Navigation',
  },
  {
    title: 'Secure boot key rotation runbook',
    description: 'Document how to rotate without bricking units.',
    estimate: 3,
    priority: 'medium',
    label: 'Security',
  },
  {
    title: 'Wheel slip detection',
    description: 'Compare commanded and measured wheel speed.',
    estimate: 5,
    priority: 'medium',
    label: 'Navigation',
  },
  {
    title: 'Charge current limit by temperature',
    description: 'Derate charging below 5 °C.',
    estimate: 3,
    priority: 'high',
    label: 'Hardware',
  },
  {
    title: 'Fleet heartbeat jitter',
    description: 'Heartbeats bunch up after a network drop.',
    estimate: 2,
    priority: 'low',
    label: 'Telemetry',
  },
  {
    title: 'Remote reboot command',
    description: 'Authenticated, rate limited, logged.',
    estimate: 3,
    priority: 'medium',
    label: 'Security',
  },
  {
    title: 'Gripper torque limits',
    description: 'Stop crushing soft packages.',
    estimate: 3,
    priority: 'medium',
    label: 'Hardware',
  },
  {
    title: 'Path planner replans too often',
    description: 'Hysteresis on cost changes.',
    estimate: 5,
    priority: 'medium',
    label: 'Navigation',
  },
  {
    title: 'Encrypt telemetry at rest',
    description: 'On-device buffer before upload.',
    estimate: 5,
    priority: 'low',
    label: 'Security',
  },
  {
    title: 'Cell balancing alarms',
    description: 'Alert when imbalance exceeds 50 mV.',
    estimate: 2,
    priority: 'medium',
    label: 'Telemetry',
  },
  {
    title: 'Night mode for status LEDs',
    description: 'Dim LEDs between 22:00 and 06:00.',
    estimate: 1,
    priority: 'none',
  },
  {
    title: 'Ultrasonic sensor cross-talk',
    description: 'Stagger the ping timing.',
    estimate: 3,
    priority: 'medium',
    label: 'Bug',
  },
  {
    title: 'Diagnostics bundle download',
    description: 'One click from the console.',
    estimate: 5,
    priority: 'low',
    label: 'Telemetry',
  },
  {
    title: 'Speed limit zones',
    description: 'Geofenced limits from the site map.',
    estimate: 5,
    priority: 'medium',
    label: 'Navigation',
  },
];

const COMMENTS = [
  'Reproduced on unit 14 with the field firmware.',
  'I think this is the same root cause as the brownout resets.',
  'Pushed a branch with a first attempt, would love a second pair of eyes.',
  'Logs from the warehouse run are attached to the ticket in the drive.',
  'Can we split this? The test harness part can land first.',
  'Confirmed fixed on the bench, waiting for a field run.',
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const { db, close } = createDatabase({ url, max: 4, applicationName: 'teamflow-seed' });

  // One transaction: a run that fails part-way leaves nothing behind, so the next run starts clean. The advisory
  // lock makes two runs at once take turns instead of racing on the same slug and emails.
  try {
    const seeded = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('teamflow-seed'))`);
      const [existing] = await tx.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
      if (existing) return false;
      await seed(tx);
      return true;
    });
    console.info(
      seeded
        ? 'Seeded Northwind Robotics. Sign in as'
        : 'Demo workspace already exists. Sign in as',
      DEMO_EMAIL,
      '/',
      DEMO_PASSWORD,
    );
  } finally {
    await close();
  }
}

async function seed(db: Executor) {
  const today = new Date();
  today.setUTCHours(9, 0, 0, 0);
  // Sprint 4 started six days ago; the three before it ran back to back.
  const start = new Date(today.getTime() - 48 * DAY);

  // People and the workspace.
  const organizationId = newId();
  await db.insert(organizations).values({
    id: organizationId,
    name: 'Northwind Robotics',
    slug: 'northwind',
    createdAt: new Date(start.getTime() - 7 * DAY),
  });
  const password = await hashPassword(DEMO_PASSWORD);
  const memberIds: string[] = [];
  for (const person of PEOPLE) {
    const userId = newId();
    const memberId = newId();
    await db.insert(users).values({
      id: userId,
      name: person.name,
      email: person.email,
      emailVerified: true,
      createdAt: start,
    });
    await db
      .insert(accounts)
      .values({ accountId: userId, providerId: 'credential', userId, password });
    await db
      .insert(members)
      .values({ id: memberId, organizationId, userId, role: person.role, createdAt: start });
    memberIds.push(memberId);
  }
  const owner = memberIds[0] ?? '';
  const asMember = (memberId: string): Scope => createScope(db, organizationId, memberId);
  const team = memberIds.slice(0, 5);

  // Projects.
  const scope = asMember(owner);
  const rover = await createProject(scope, {
    key: 'RF',
    name: 'Rover Firmware',
    description: 'Everything that runs on the robot.',
    color: '#4f6d8f',
  });
  await createProject(scope, {
    key: 'FC',
    name: 'Fleet Console',
    description: 'The operator web app.',
    color: '#5d7d5a',
  });
  await createProject(scope, {
    key: 'DOC',
    name: 'Field Docs',
    description: 'Runbooks and guides.',
    color: '#b0723a',
  });

  const status = (name: string) => rover.statuses.find((s) => s.name === name)?.id ?? '';
  const labelIds = new Map<string, string>();
  for (const [name, color] of [
    ['Bug', '#c2412d'],
    ['Hardware', '#4f7f80'],
    ['Telemetry', '#6b5f99'],
    ['Navigation', '#5d7d5a'],
    ['Security', '#8a5a7a'],
  ] as const) {
    const id = newId();
    await db
      .insert(labels)
      .values({ id, organizationId, projectId: rover.project.id, name, color });
    labelIds.set(name, id);
  }

  // Every task starts in the backlog on day zero.
  const tasks: { id: string; version: number; estimate: number; assignee: string }[] = [];
  for (const [i, item] of BACKLOG.entries()) {
    const assignee = pick(team);
    const task = await createTask(
      asMember(pick(team)),
      {
        projectId: rover.project.id,
        title: item.title,
        description: item.description,
        estimate: item.estimate,
        priority: item.priority,
        statusId: status('Backlog'),
        assigneeMemberId: assignee,
        ...(item.label ? { labelIds: [labelIds.get(item.label) ?? ''] } : {}),
      },
      new Date(start.getTime() - DAY + i * 60_000),
    );
    if (task) tasks.push({ id: task.id, version: task.version, estimate: item.estimate, assignee });
  }

  const at = (day: number, hour = 10) =>
    new Date(start.getTime() + day * DAY + (hour - 9) * 3_600_000);
  const bump = async (
    index: number,
    fn: (t: (typeof tasks)[number]) => Promise<{ version: number } | null>,
  ) => {
    const t = tasks[index];
    if (!t) return;
    const result = await fn(t);
    if (result) t.version = result.version;
  };

  // Four two-week sprints: three finished, the fourth running now.
  const plans = [
    { name: 'Sprint 1', from: 0, take: [0, 1, 2, 6, 9, 13] },
    { name: 'Sprint 2', from: 14, take: [3, 4, 5, 8, 18, 23] },
    { name: 'Sprint 3', from: 28, take: [7, 10, 11, 14, 19, 24] },
    { name: 'Sprint 4', from: 42, take: [12, 15, 16, 17, 20, 21] },
  ];
  let carried: number[] = [];
  let previous: { id: string; version: number } | null = null;
  for (const [n, plan] of plans.entries()) {
    const sprint = await createSprint(scope, {
      projectId: rover.project.id,
      name: plan.name,
      goal:
        [
          'Stabilise power and telemetry',
          'Ship signed updates',
          'Navigation you can trust',
          'Docking and safety',
        ][n] ?? '',
      startsAt: at(plan.from, 9),
      endsAt: at(plan.from + 14, 9),
    });
    if (previous) {
      const target: string = sprint.id;
      await completeSprint(scope, previous.id, previous.version, target, at(plan.from, 9));
    }
    const committed = [...new Set([...carried, ...plan.take])];
    for (const index of plan.take) {
      await bump(index, (t) =>
        updateTask(
          scope,
          t.id,
          t.version,
          { sprintId: sprint.id, statusId: status('Todo') },
          at(plan.from, 9),
        ),
      );
    }
    // Completing the previous sprint moved the carried tasks; pick up their new versions.
    for (const index of carried) {
      const t = tasks[index];
      const fresh = t ? await findTask(scope, t.id) : null;
      if (t && fresh) t.version = fresh.version;
    }
    const started = await startSprint(scope, sprint.id, sprint.version, at(plan.from, 9));
    if (!started) throw new Error('sprint did not start');

    // Work happens on weekdays; the running sprint is only six days in.
    const days = n === plans.length - 1 ? 6 : 13;
    const finishing =
      n === plans.length - 1
        ? committed.slice(0, 2)
        : committed.slice(0, committed.length - (n === 1 ? 2 : 1));
    for (const [k, index] of committed.entries()) {
      const t = tasks[index];
      if (!t) continue;
      const begin = Math.min(days, 1 + Math.floor((k / committed.length) * (days - 2)));
      await bump(index, (task) =>
        moveTask(
          asMember(task.assignee),
          task.id,
          task.version,
          { statusId: status('In Progress') },
          at(plan.from + begin, 10 + k),
        ),
      );
      if (random() < 0.5) {
        await createComment(
          asMember(pick(team)),
          { taskId: t.id, body: pick(COMMENTS), mentions: [] },
          at(plan.from + begin, 15),
        );
      }
      if (finishing.includes(index)) {
        const review = Math.min(days, begin + 1 + Math.floor(random() * 3));
        await bump(index, (task) =>
          moveTask(
            asMember(task.assignee),
            task.id,
            task.version,
            { statusId: status('In Review') },
            at(plan.from + review, 11),
          ),
        );
        await bump(index, (task) =>
          moveTask(
            asMember(pick(team)),
            task.id,
            task.version,
            { statusId: status('Done') },
            at(plan.from + Math.min(days, review + 1), 16),
          ),
        );
      }
    }
    // Something unplanned always turns up mid-sprint.
    const late = await createTask(
      asMember(pick(team)),
      {
        projectId: rover.project.id,
        title:
          [
            'Hotfix: telemetry drops after reconnect',
            'Field report: rover stuck at dock',
            'Hotfix: OTA retry loop',
            'Investigate stop button debounce',
          ][n] ?? 'Unplanned work',
        estimate: 2,
        priority: 'urgent',
        sprintId: sprint.id,
        statusId: status('Todo'),
        labelIds: [labelIds.get('Bug') ?? ''],
      },
      at(plan.from + 4, 13),
    );
    if (late && n < plans.length - 1) {
      const moved = await moveTask(
        scope,
        late.id,
        late.version,
        { statusId: status('In Progress') },
        at(plan.from + 5, 10),
      );
      if (moved)
        await moveTask(
          scope,
          late.id,
          moved.version,
          { statusId: status('Done') },
          at(plan.from + 6, 17),
        );
    }
    carried = committed.filter((i) => !finishing.includes(i));
    previous = { id: started.id, version: started.version };
  }

  // A mention waiting in the demo user's inbox.
  const first = tasks[12];
  if (first) {
    await createComment(
      asMember(memberIds[1] ?? ''),
      {
        taskId: first.id,
        body: '@Demo User the AprilTag detector needs the rear camera calibration first, can you take that?',
        mentions: [owner],
      },
      at(47, 16),
    );
  }

  // Due dates around today, so the calendar has a month to show: open work over the next three weeks (one item
  // overdue), and a couple of recently finished tasks that met theirs.
  const iso = (offset: number) =>
    new Date(today.getTime() + offset * DAY).toISOString().slice(0, 10);
  const open: string[] = [];
  const finished: string[] = [];
  for (const { id } of tasks) {
    const task = await findTask(scope, id);
    if (task) (task.statusId === status('Done') ? finished : open).push(task.id);
  }
  const plan: [string | undefined, number][] = [
    ...[-2, -1, 0, 1, 2, 3, 5, 7, 9, 12, 14].map((offset, i): [string | undefined, number] => [
      open[i],
      offset,
    ]),
    [finished.at(-1), -5],
    [finished.at(-2), -3],
  ];
  for (const [id, offset] of plan) {
    const task = id ? await findTask(scope, id) : null;
    if (task) await updateTask(scope, task.id, task.version, { dueDate: iso(offset) }, at(47, 9));
  }
}

await main();

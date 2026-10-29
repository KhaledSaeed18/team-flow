import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@teamflow/ui';
import type { ReactNode } from 'react';
import { orpc } from '../../lib/api.ts';
import { BlockSwatch, BurndownChart, Legend, LineSwatch, VelocityChart } from './charts.tsx';
import { sprintDates, sprintTiming } from './queries.ts';

const dayLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-ink-muted text-xs">{label}</p>
      <p className="mt-1 font-semibold text-2xl tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-ink-faint text-xs">{detail}</p>}
    </div>
  );
}

export function SprintReport({ sprintId }: { sprintId: string }) {
  const report = useQuery(orpc.sprints.report.queryOptions({ input: { id: sprintId } }));
  if (report.isPending) return <Spinner className="m-8" />;
  if (!report.data)
    return <p className="p-8 text-ink-muted text-sm">This sprint could not be loaded.</p>;

  const {
    sprint,
    committed,
    days,
    scopeAdded,
    scopeRemoved,
    velocity,
    history,
    medianCycleTimeHours,
  } = report.data;
  const final = days.at(-1);
  const completedPoints = final ? final.totalPoints - final.remainingPoints : 0;
  const burndown = days.map((d) => ({
    label: dayLabel.format(d.at),
    remaining: d.remainingPoints,
    ideal: d.idealPoints,
  }));
  const velocityData = history.map((h) => ({
    label: h.name,
    committed: h.committedPoints,
    completed: h.completedPoints,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header>
        <h2 className="font-semibold text-lg">{sprint.name}</h2>
        <p className="mt-1 text-ink-muted text-sm">
          {sprintDates(sprint)}. {sprintTiming(sprint)}.
        </p>
        {sprint.goal && <p className="mt-2 max-w-prose text-sm leading-relaxed">{sprint.goal}</p>}
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Committed"
          value={committed.totalPoints}
          detail={`${committed.totalTasks} tasks at the start`}
        />
        <Stat
          label="Completed"
          value={completedPoints}
          detail={final ? `${final.remainingPoints} points left` : undefined}
        />
        <Stat
          label="Scope change"
          value={`+${scopeAdded} / −${scopeRemoved}`}
          detail="Points added and removed since the start"
        />
        <Stat
          label="Median cycle time"
          value={
            medianCycleTimeHours === null
              ? '—'
              : medianCycleTimeHours < 48
                ? `${medianCycleTimeHours} h`
                : `${Math.round(medianCycleTimeHours / 24)} d`
          }
          detail="First start to done"
        />
      </div>

      <section
        aria-labelledby="burndown-title"
        className="rounded-lane border border-line bg-surface p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="burndown-title" className="font-medium text-sm">
            Burndown
          </h3>
          <Legend
            items={[
              { label: 'Remaining points', swatch: <LineSwatch color="var(--color-chart-1)" /> },
              { label: 'Ideal', swatch: <LineSwatch dashed color="var(--color-ink-faint)" /> },
            ]}
          />
        </div>
        {burndown.length === 0 ? (
          <p className="py-10 text-center text-ink-muted text-sm">
            The burndown starts once the sprint does.
          </p>
        ) : (
          <div className="mt-3">
            <BurndownChart
              data={burndown}
              title={`Burndown for ${sprint.name}: remaining points by day`}
            />
          </div>
        )}
        <DataTable
          caption="Burndown by day"
          headers={['Day', 'Remaining points', 'Ideal', 'Remaining tasks']}
          rows={days.map((d) => [
            dayLabel.format(d.at),
            d.remainingPoints,
            d.idealPoints,
            d.remainingTasks,
          ])}
        />
      </section>

      <section
        aria-labelledby="velocity-title"
        className="rounded-lane border border-line bg-surface p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="velocity-title" className="font-medium text-sm">
            Velocity{' '}
            <span className="font-normal text-ink-muted">
              averaging {Math.round(velocity * 10) / 10} points per sprint
            </span>
          </h3>
          <Legend
            items={[
              { label: 'Committed', swatch: <BlockSwatch color="var(--color-chart-1)" /> },
              { label: 'Completed', swatch: <BlockSwatch color="var(--color-chart-2)" /> },
            ]}
          />
        </div>
        {velocityData.length === 0 ? (
          <p className="py-10 text-center text-ink-muted text-sm">
            Velocity appears after the first sprint is completed.
          </p>
        ) : (
          <div className="mt-3">
            <VelocityChart
              data={velocityData}
              title="Committed and completed points per completed sprint"
            />
          </div>
        )}
        <DataTable
          caption="Points per completed sprint"
          headers={['Sprint', 'Committed', 'Completed']}
          rows={history.map((h) => [h.name, h.committedPoints, h.completedPoints])}
        />
      </section>
    </div>
  );
}

/** The same numbers as the chart, for screen readers and anyone who prefers a table. */
function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-ink-muted text-xs outline-none focus-visible:outline-2 focus-visible:outline-marigold">
        Show as a table
      </summary>
      <table className="mt-2 w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-ink-muted">
            {headers.map((h) => (
              <th key={h} className="border-line border-b py-1.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])}>
              {row.map((cell, i) => (
                <td key={headers[i]} className="border-line border-b py-1.5 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

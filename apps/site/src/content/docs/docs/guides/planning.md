---
title: Sprints and metrics
description: Planning, carry-over, and charts computed from the activity log.
sidebar:
  order: 2
---

![A sprint report](/screenshots/report.png)

A sprint has a goal, dates and a set of tasks. Starting it records what was committed. Completing it moves
unfinished work to the next sprint or back to the backlog.

## The report

- **Burndown:** points remaining each day, against the ideal line from what was committed.
- **Scope change:** points added and removed after the start, so a burndown that does not go down can be
  explained.
- **Cumulative flow:** how many tasks are to do, in progress and done each day. A widening middle band means
  work is piling up.
- **Velocity:** committed against completed points for recent sprints, and their average.
- **Cycle time:** the median time from a task's first start to its completion.

Every chart has a **Show as a table** view, and the colors are validated for colorblind separation and contrast
in both themes.

## Why the numbers are honest

Nothing is snapshotted. Every change to a task is written to an append-only activity log in the same transaction
as the change itself. Each chart replays that log to rebuild every task's status, sprint and estimate at the end
of each day. A metric added later works for sprints that finished long before it existed.

---
title: Board, list and calendar
description: Four views of the same tasks, and how to drive each from the keyboard.
sidebar:
  order: 1
---

Every project has the same tasks in four views. Changes are optimistic: a card moves the moment you drop it, and
the server's answer follows in the background.

## Board

![The board with a task open beside it](/screenshots/board.png)

Columns are the project's statuses, filtered to a sprint. Drag a card to move it, or do it from the keyboard:
arrow keys move between cards, **Enter** on a card's handle picks it up, **Tab** moves through drop positions,
and **Enter** drops it. Order within a column is stored as a fractional rank, so two people moving cards at once
never collide.

Opening a card shows the task beside the board rather than over it, so you can still see the board while you
edit. That panel holds the shared description, properties, sub-tasks, linked tasks, attachments, comments and
history.

## List

![The list, sorted by priority](/screenshots/list.png)

A virtualized table of every task in the project. Sort by any column, search by title or ID, and filter by
assignee (including _me_ and _unassigned_), priority, label and status. Every filter lives in the URL, so a
filtered list can be shared as a link.

**Saved views** keep a filter and sort under a name. Keep them private, or share them with the workspace. A shared
"My open work" view means whoever opens it, because _me_ is resolved for each viewer. When you change a
view's filters it shows **edited**, and you can save the change or reset.

## Calendar

![The calendar with unscheduled work beside it](/screenshots/calendar.png)

Tasks by due date, a month at a time. Drag a card by its handle to another day to reschedule it, onto the
Unscheduled tray to clear its date, or from the tray onto a day. The handle works with the keyboard as on the
board.

## Planning

The backlog and sprints: plan the next sprint, start it, and complete it. Unfinished work carries over to the
next sprint. Each sprint has a [report](/docs/guides/planning/).

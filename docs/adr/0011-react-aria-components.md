# 0011 — React Aria Components for the design system and drag and drop

- Status: Accepted
- Date: 2026-10-29
- Amends: [0009](0009-vite-spa-with-tanstack.md) (which named dnd-kit for drag and drop)

## Context

TeamFlow is keyboard-first, and its central interaction is moving cards on a board. Most drag-and-drop libraries
are pointer-first; keyboard and screen-reader support is either missing or left to the app. The component layer
also needs menus, dialogs, comboboxes and lists that behave correctly with a keyboard and assistive technology.

## Decision

- `packages/ui` is built on **React Aria Components** (unstyled, accessible primitives) styled with Tailwind v4 and
  `tailwind-variants`. Components are owned in the repo.
- Board columns are React Aria `GridList`s with `useDragAndDrop`. The same handlers serve mouse, touch, keyboard
  (Enter on a card's move handle, Tab between drop positions, Enter to drop) and screen readers (live
  announcements of every drop position). dnd-kit is not used.
- Icons are Phosphor.

## Consequences

- Accessible drag and drop between columns comes from the platform rather than custom code.
- Drop positions are expressed as "before/after task X" or "into column", which maps one-to-one onto the
  `tasks.move` contract (`afterId` / `beforeId` / status).

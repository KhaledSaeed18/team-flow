# Brand

The TeamFlow mark is three cards in a column, one of them marigold: the colour the product reserves for focus. The
same mark is used everywhere, from one source.

| File                     | Where it is used                                                        |
| ------------------------ | ----------------------------------------------------------------------- |
| `teamflow-mark.svg`      | The source mark (ink square). Copied to both favicons and the docs logo |
| `teamflow-mark-dark.svg` | The mark on dark backgrounds (light square), as in the app's dark theme |
| `teamflow-logo.png`      | Mark and wordmark, for light backgrounds (the README)                   |
| `teamflow-logo-dark.png` | Mark and wordmark, for dark backgrounds                                 |

The app draws the same mark inline (`apps/web/src/components/logo.tsx`), using its theme tokens. Emails carry a PNG
of it as an inline attachment (`packages/email/src/assets`), because mail clients neither render SVG nor load remote
images by default.

The wordmark is set in Schibsted Grotesk, semibold, the app's typeface. The PNG lockups are rendered from it, so they
look the same where the font is not installed, such as on GitHub.

| Token    | Light     | Dark      |
| -------- | --------- | --------- |
| Ink      | `#1b2430` | `#e6ebf0` |
| Canvas   | `#eef1f4` | `#141920` |
| Marigold | `#e8a317` | `#f2b632` |

/**
 * Turns the two demo recordings (`DEMO=1 bunx playwright test demo`) into the README GIF: the two screens one
 * above the other, then a two-pass palette so the UI's flat colours stay clean. Needs ffmpeg on the PATH.
 */
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../test-results/demo/', import.meta.url));
const out = fileURLToPath(new URL('../../../assets/images/teamflow-demo.gif', import.meta.url));
const width = Number(process.env.DEMO_WIDTH ?? 880);
const fps = Number(process.env.DEMO_FPS ?? 12);
// The first second is the pages loading.
const skip = process.env.DEMO_SKIP ?? '1.2';

const graph = [
  `[0:v]trim=start=${skip},setpts=PTS-STARTPTS,pad=iw:ih+8:0:0:color=0x1b2430[top]`,
  `[1:v]trim=start=${skip},setpts=PTS-STARTPTS[bottom]`,
  '[top][bottom]vstack=shortest=1[stack]',
  `[stack]fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b]`,
  '[a]palettegen=max_colors=128:stats_mode=diff[p]',
  '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
].join(';');

const ffmpeg = Bun.spawn(
  [
    'ffmpeg',
    '-y',
    '-loglevel',
    'error',
    '-i',
    `${dir}demo.webm`,
    '-i',
    `${dir}maya.webm`,
    '-filter_complex',
    graph,
    out,
  ],
  { stdout: 'inherit', stderr: 'inherit' },
);
if ((await ffmpeg.exited) !== 0) process.exit(1);
process.stdout.write(`wrote ${out} (${(Bun.file(out).size / 1e6).toFixed(1)} MB)\n`);

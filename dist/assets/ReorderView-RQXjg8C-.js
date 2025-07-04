const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = ['assets/reorder-CQCu2smL.js', 'assets/index-DJCdj0tE.js', 'assets/index-D3xn2g9s.css'])
) => i.map((i) => d[i]);
import { _ as i } from './index-DJCdj0tE.js';
async function e() {
  return (
    await i(() => import('./reorder-CQCu2smL.js'), __vite__mapDeps([0, 1, 2]))
  ).initializeReorder();
}
export { e as init };

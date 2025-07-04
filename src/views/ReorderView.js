export async function init() {
  const module = await import('../ui/habits/reorder.js');
  return module.initializeReorder();
}

export async function init() {
  const module = await import('../ui/habits/list.js');
  return module.initializeHabitsList();
}

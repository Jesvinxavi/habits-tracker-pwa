export async function init() {
  const module = await import('../ui/categories.js');
  return module.initializeCategories();
}

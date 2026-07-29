/**
 * Compares two short selector tuples by reference/value. This keeps a view
 * asleep when an unrelated state branch changes without deep comparisons.
 * @param {unknown[]} left
 * @param {unknown[]} right
 * @returns {boolean}
 */
export function shallowArrayEqual(left, right) {
  return (
    left === right ||
    (Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => Object.is(value, right[index])))
  );
}

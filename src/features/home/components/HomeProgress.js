// HomeProgress.js - Progress component for the home view
import { updateProgressRing } from './ProgressRing.js';
import { updateProgressPills } from './HomeProgressPills.js';
import { getCurrentContextProgress } from '../../../selectors/progress.js';

export { updateProgressRing, updateProgressPills };

/**
 * HomeProgress component that manages progress ring and pills
 */
export const HomeProgress = {
  /**
   * Mounts the progress component
   */
  mount(container) {
    this.container = container;

    // The progress ring is already in the DOM from the HTML template
    // We just need to update it
    this.render();
  },

  /**
   * Renders the progress components
   */
  render() {
    // Calculate and update progress ring using memoized selector
    const progress = getCurrentContextProgress();
    updateProgressRing(progress);

    // Update progress pills
    updateProgressPills();
  },

  /**
   * Unmounts the progress component
   */
  unmount() {
    // No cleanup needed for progress components
    // They are part of the main DOM structure
  },
};

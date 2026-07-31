/**
 * A screen that will not open has three possible causes, and telling the user
 * the wrong one sends them to fix something that is not broken. These pin each
 * cause to its own message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const showConfirm = vi.fn();
vi.mock('../../src/components/ConfirmDialog.js', () => ({ showConfirm }));

const statsOpen = vi.fn();

/** Every other lazily loaded dialog, stubbed so the module can be imported. */
for (const path of [
  'AddEditActivityModal',
  'ActivityDetailsModal',
  'ActivityInfoModal',
  'ActivityLibraryModal',
  'RoutinesModal',
  'RoutineBuilderModal',
  'RoutinePickerModal',
  'ActivityPickerModal',
  'ProgramBuilderModal',
  'ProgramDetailsModal',
]) {
  vi.doMock(`../../src/features/fitness/Modals/${path}.js`, () => ({
    [path]: { open: vi.fn(), openCreateMode: vi.fn(), openEditMode: vi.fn(), openAddMode: vi.fn() },
  }));
}

/**
 * Imports a fresh copy of the modal orchestrator with the statistics screen
 * behaving as the test needs, so each case starts with an empty chunk cache.
 * @param {() => object} statsFactory What importing the statistics screen does.
 * @returns {Promise<object>} The module.
 */
async function freshModals(statsFactory) {
  vi.resetModules();
  vi.doMock('../../src/features/fitness/Modals/StatsModal.js', statsFactory);
  return import('../../src/features/fitness/FitnessModals.js');
}

beforeEach(() => {
  showConfirm.mockClear();
  statsOpen.mockReset();
  vi.stubGlobal('navigator', { ...globalThis.navigator, onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a screen that will not open', () => {
  it('offers a reload when the chunk is missing but the network is fine', async () => {
    const { Modals } = await freshModals(() => {
      throw new Error('Failed to fetch dynamically imported module');
    });

    await Modals.openStats('act-1');

    expect(showConfirm).toHaveBeenCalledTimes(1);
    const dialog = showConfirm.mock.calls[0][0];
    expect(dialog.title).toBe('Update needed');
    expect(dialog.message).not.toMatch(/connection|internet/i);
    expect(dialog.okText).toBe('Reload');
  });

  it('blames the connection only when the device is actually offline', async () => {
    vi.stubGlobal('navigator', { ...globalThis.navigator, onLine: false });
    const { Modals } = await freshModals(() => {
      throw new Error('Failed to fetch dynamically imported module');
    });

    await Modals.openStats('act-1');

    expect(showConfirm.mock.calls[0][0].title).toBe('You’re offline');
  });

  it('does not mention the network when the screen itself threw', async () => {
    const { Modals } = await freshModals(() => ({
      StatsModal: {
        open: () => {
          throw new TypeError('cannot read properties of undefined');
        },
      },
    }));

    await Modals.openStats('act-1');

    const dialog = showConfirm.mock.calls[0][0];
    expect(dialog.title).toBe('Something went wrong');
    expect(dialog.message).not.toMatch(/connection|internet|offline|reload/i);
  });

  it('says nothing at all when the screen opens', async () => {
    const { Modals } = await freshModals(() => ({ StatsModal: { open: statsOpen } }));

    await Modals.openStats('act-1');

    expect(statsOpen).toHaveBeenCalledWith('act-1');
    expect(showConfirm).not.toHaveBeenCalled();
  });
});

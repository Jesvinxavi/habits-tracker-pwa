import { describe, expect, it, vi } from 'vitest';
import {
  createCoalescedRemoteQueue,
  nextInclusiveWatermark,
  queryAllPages,
} from '../../src/core/cloudBootstrap.js';

describe('remote history paging', () => {
  it('reads every page beyond the old 500-record subscription ceiling', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      clientId: `entry-${index}`,
    }));
    const secondPage = [
      { clientId: 'entry-500' },
      { clientId: 'entry-501' },
    ];
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        generation: 7,
        page: firstPage,
        isDone: false,
        continueCursor: 'page-2',
      })
      .mockResolvedValueOnce({
        generation: 7,
        page: secondPage,
        isDone: true,
        continueCursor: '',
      });

    const records = await queryAllPages(
      { query },
      'sync:listChangedEntities',
      { entityType: 'habitEntries', sinceUpdatedAt: 100 },
      { expectedGeneration: 7 }
    );

    expect(records).toHaveLength(502);
    expect(records.at(-1).clientId).toBe('entry-501');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1].paginationOpts).toEqual({
      numItems: 500,
      cursor: null,
    });
    expect(query.mock.calls[1][1].paginationOpts).toEqual({
      numItems: 500,
      cursor: 'page-2',
    });
  });

  it('rejects a page from a newly activated generation', async () => {
    const query = vi.fn().mockResolvedValue({
      generation: 8,
      page: [],
      isDone: true,
      continueCursor: '',
    });

    await expect(
      queryAllPages(
        { query },
        'sync:listChangedEntities',
        { entityType: 'restDays', sinceUpdatedAt: 0 },
        { expectedGeneration: 7 }
      )
    ).rejects.toThrow('REMOTE_GENERATION_CHANGED');
  });

  it('keeps equal timestamps in the next inclusive query', () => {
    expect(
      nextInclusiveWatermark(
        100,
        { updatedAt: 100 },
        [
          { clientId: 'first', updatedAt: 100 },
          { clientId: 'same-millisecond', updatedAt: 100 },
        ]
      )
    ).toBe(100);
  });

  it('retains tombstones while fetching every changed-record page', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        generation: 7,
        page: Array.from({ length: 500 }, (_, index) => ({
          clientId: `entry-${index}`,
          updatedAt: 100,
        })),
        isDone: false,
        continueCursor: 'page-2',
      })
      .mockResolvedValueOnce({
        generation: 7,
        page: [
          {
            clientId: 'entry-removed',
            periodSortDate: '2026-07-30',
            updatedAt: 100,
            deletedAt: 101,
          },
        ],
        isDone: true,
        continueCursor: '',
      });

    const records = await queryAllPages(
      { query },
      'sync:listChangedEntities',
      { entityType: 'habitEntries', sinceUpdatedAt: 100 },
      { expectedGeneration: 7 }
    );

    expect(query).toHaveBeenCalledTimes(2);
    expect(records).toHaveLength(501);
    expect(records.at(-1)).toMatchObject({
      clientId: 'entry-removed',
      deletedAt: 101,
    });
  });
});

describe('coalesced remote refresh queue', () => {
  it('coalesces a same-tick burst before I/O and delivers hydrated state once', async () => {
    const events = [];
    const queue = createCoalescedRemoteQueue({
      initialGeneration: 4,
      processCore: vi.fn(async () => false),
      processSignals: async (signals) => {
        events.push(`signals:${signals.map((signal) => signal.revision).join(',')}`);
        return true;
      },
      afterBatch: async () => {
        events.push('hydrate');
      },
    });

    queue.requestSignals({
      generation: 4,
      signals: [{ entityType: 'habitEntries', revision: 1 }],
    });
    queue.requestSignals({
      generation: 4,
      signals: [{ entityType: 'habitEntries', revision: 2 }],
    });
    queue.requestSignals({
      generation: 4,
      signals: [{ entityType: 'activityRecords', revision: 3 }],
    });
    await queue.whenIdle();

    expect(events).toEqual([
      'signals:2,3',
      'hydrate',
    ]);
  });

  it('serializes a callback arriving while the current refresh is in flight', async () => {
    const events = [];
    let releaseFirst;
    let firstStarted;
    const firstProcessing = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    const started = new Promise((resolve) => {
      firstStarted = resolve;
    });
    const queue = createCoalescedRemoteQueue({
      initialGeneration: 4,
      processCore: async () => false,
      processSignals: async (signals) => {
        events.push(`signals:${signals.map((signal) => signal.revision).join(',')}`);
        if (signals[0].revision === 1) {
          firstStarted();
          await firstProcessing;
        }
        return true;
      },
      afterBatch: async () => events.push('hydrate'),
    });

    queue.requestSignals({
      generation: 4,
      signals: [{ entityType: 'habitEntries', revision: 1 }],
    });
    await started;
    queue.requestSignals({
      generation: 4,
      signals: [{ entityType: 'habitEntries', revision: 2 }],
    });
    queue.requestSignals({
      generation: 4,
      signals: [{ entityType: 'activityRecords', revision: 3 }],
    });
    releaseFirst();
    await queue.whenIdle();

    expect(events).toEqual(['signals:1', 'signals:2,3', 'hydrate']);
  });

  it('invalidates in-flight work as soon as a new generation is observed', async () => {
    const events = [];
    let releaseOldGeneration;
    const oldGenerationBlocked = new Promise((resolve) => {
      releaseOldGeneration = resolve;
    });
    const queue = createCoalescedRemoteQueue({
      initialGeneration: 1,
      processCore: async (core, { expectedGeneration, isCurrent }) => {
        events.push(`core:${core.generation}`);
        expect(expectedGeneration).toBe(2);
        expect(isCurrent()).toBe(true);
        return true;
      },
      processSignals: async (signals, { isCurrent }) => {
        events.push(`start:${signals[0].revision}`);
        await oldGenerationBlocked;
        events.push(`old-current:${isCurrent()}`);
        return isCurrent();
      },
      afterBatch: async ({ generation }) => {
        events.push(`hydrate:${generation}`);
      },
    });

    queue.requestSignals({
      generation: 1,
      signals: [{ entityType: 'habitEntries', revision: 1 }],
    });
    await new Promise((resolve) => {
      const checkStarted = () => {
        if (events.includes('start:1')) resolve();
        else queueMicrotask(checkStarted);
      };
      checkStarted();
    });
    queue.requestCore({ generation: 2 });
    releaseOldGeneration();
    await queue.whenIdle();

    expect(events).toEqual([
      'start:1',
      'old-current:false',
      'core:2',
      'hydrate:2',
    ]);
  });

  it('does one changed-record write pass and one state delivery for one signal', async () => {
    const processSignals = vi.fn(async () => true);
    const afterBatch = vi.fn(async () => {});
    const queue = createCoalescedRemoteQueue({
      initialGeneration: 4,
      processCore: async () => false,
      processSignals,
      afterBatch,
    });

    queue.requestSignals({
      generation: 4,
      signals: [{ entityType: 'restDays', revision: 1 }],
    });
    await queue.whenIdle();

    expect(processSignals).toHaveBeenCalledTimes(1);
    expect(processSignals.mock.calls[0][0]).toEqual([
      { entityType: 'restDays', revision: 1 },
    ]);
    expect(afterBatch).toHaveBeenCalledTimes(1);
  });
});

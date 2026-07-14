import { describe, expect, it } from 'vitest';

import { buildWorkQueue, filterWorkQueue } from '../src/lib/workQueue';
import type { OwnerNotification, OwnerTask } from '../src/types/tasks';

describe('workQueue', () => {
  it('merges tasks and alerts into one queue', () => {
    const tasks: OwnerTask[] = [
      {
        contactLabel: 'Maria',
        conversationId: 'conv-1',
        description: 'Follow up',
        dueAt: '2026-07-15T10:00:00.000Z',
        id: 'task-1',
        priority: 'high',
        snoozedUntil: null,
        status: 'pending',
        taskType: 'follow_up',
        title: 'Follow up with Maria',
      },
    ];
    const notifications: OwnerNotification[] = [
      {
        body: 'Low stock',
        createdAt: '2026-07-14T10:00:00.000Z',
        errorMessage: null,
        id: 'alert-1',
        notificationType: 'low_stock',
        payload: { productId: 'prod-1' },
        productId: 'prod-1',
        productLabel: 'Yerba: 2/10',
        pushSentAt: null,
        status: 'pending',
        title: 'Low stock alert',
      },
    ];

    const queue = buildWorkQueue(tasks, notifications);
    expect(queue).toHaveLength(2);
    expect(queue.some((item) => item.kind === 'task')).toBe(true);
    expect(queue.some((item) => item.kind === 'alert' && item.productId === 'prod-1')).toBe(true);
  });

  it('filters stock alerts only', () => {
    const queue = buildWorkQueue(
      [
        {
          contactLabel: null,
          conversationId: null,
          description: null,
          dueAt: null,
          id: 'task-1',
          priority: 'normal',
          snoozedUntil: null,
          status: 'pending',
          taskType: 'manual',
          title: 'Manual task',
        },
      ],
      [
        {
          body: 'Low stock',
          createdAt: '2026-07-14T10:00:00.000Z',
          errorMessage: null,
          id: 'alert-1',
          notificationType: 'low_stock',
          payload: {},
          productId: 'prod-1',
          productLabel: null,
          pushSentAt: null,
          status: 'pending',
          title: 'Low stock alert',
        },
      ],
    );

    expect(filterWorkQueue(queue, 'stock')).toHaveLength(1);
    expect(filterWorkQueue(queue, 'stock')[0]?.kind).toBe('alert');
  });
});

import { describe, expect, it } from 'vitest';

import { prepareTaskBody } from '../src/lib/taskDetail';
import { buildWorkQueue, compactTaskTitle, filterWorkQueue } from '../src/lib/workQueue';
import type { OwnerNotification, OwnerTask } from '../src/types/tasks';

describe('workQueue', () => {
  it('compacts long Copi presupuesto task titles', () => {
    expect(
      compactTaskTitle(
        'Trabajar sobre PRES-MSHZXECG (Castañas De Caju Natural Crudo granel)',
      ),
    ).toMatch(/castañ/i);
    expect(
      compactTaskTitle(
        'Trabajar sobre PRES-MSHZXECG (Castañas De Caju Natural Crudo granel)',
      ).length,
    ).toBeLessThanOrEqual(40);
  });

  it('merges tasks and alerts into one queue', () => {
    const tasks: OwnerTask[] = [
      {
        assignedToUserId: null,
        assigneeLabel: null,
        contactId: null,
        contactLabel: 'Maria',
        conversationId: 'conv-1',
        createdByUserId: null,
        description: 'Follow up',
        dueAt: '2026-07-15T10:00:00.000Z',
        id: 'task-1',
        isFollowing: false,
        metadata: {},
        postponedUntil: null,
        priority: 'high',
        presupuestoId: null,
        reminderSnoozedUntil: null,
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
          assignedToUserId: null,
          assigneeLabel: null,
          contactId: null,
          contactLabel: null,
          conversationId: null,
          createdByUserId: null,
          description: null,
          dueAt: null,
          id: 'task-1',
          isFollowing: false,
          metadata: {},
          postponedUntil: null,
          priority: 'normal',
          presupuestoId: null,
          reminderSnoozedUntil: null,
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

describe('prepareTaskBody', () => {
  it('cleans messy Copi presupuesto descriptions', () => {
    expect(
      prepareTaskBody(
        '55 gramos de castaña de caju. También Presupuesto: PRES-MSHZXECG',
        'PRES-MSHZXECG',
      ),
    ).toBe('55 gramos de castaña de caju');
  });

  it('returns null when only the presupuesto code remains', () => {
    expect(prepareTaskBody('Presupuesto: PRES-MSHZXECG', 'PRES-MSHZXECG')).toBeNull();
  });
});

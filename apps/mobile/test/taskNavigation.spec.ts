import { describe, expect, it } from 'vitest';

import {
  parseInventoryReturnTo,
  resolveInventoryReturnRoute,
  taskDetailRoute,
  tasksRoute,
} from '../src/navigation/routes';

describe('task navigation', () => {
  it('builds all-tasks and source-aware task detail routes', () => {
    expect(tasksRoute()).toBe('/(app)/tasks');
    expect(taskDetailRoute('task-1', 'notifications')).toBe(
      '/(app)/tasks/task-1?returnTo=notifications',
    );
  });

  it('returns alert products to Home or Notifications', () => {
    expect(parseInventoryReturnTo('home')).toBe('home');
    expect(resolveInventoryReturnRoute('home', 'product-1')).toBe('/(app)');
    expect(parseInventoryReturnTo('notifications')).toBe('notifications');
    expect(resolveInventoryReturnRoute('notifications', 'product-1')).toBe(
      '/(app)/notifications',
    );
  });
});

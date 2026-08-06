import { describe, expect, it } from 'vitest';

import {
  inferCopiActionType,
  recoverCreateTaskProposal,
} from '../src/domains/ai/copi-action.service';
import {
  parseCreatePresupuestoRequest,
  parseCreateTaskItems,
  readTaskItems,
  wantsCreatePresupuestoAction,
} from '../src/domains/ai/copi-task-parse';

describe('inferCopiActionType', () => {
  it('prefers create_task when the message both creates tasks and mentions mañana', () => {
    const question =
      'Crear 3 tareas: 1. Para notificar a juli para retirar el pedido. 2. Tarea para crear paquetes de harina 500 gramos y asignarlo a neto, 3. Mañana por la mañana hacer pedido para comprar leche';

    expect(inferCopiActionType(question)).toBe('create_task');
  });

  it('does not treat mañana alone as snooze when creating a task', () => {
    expect(inferCopiActionType('Creá una tarea para llamar a un cliente mañana')).toBe(
      'create_task',
    );
  });

  it('still detects explicit snooze', () => {
    expect(inferCopiActionType('Posponé la tarea del seguimiento')).toBe('snooze_task');
  });

  it('detects standalone presupuesto creation', () => {
    expect(
      inferCopiActionType('Creá un presupuesto para Pablo y asignalo a Juli'),
    ).toBe('create_presupuesto');
  });

  it('keeps presupuesto-inside-task requests as create_task', () => {
    expect(
      inferCopiActionType('Creá una tarea para crear presupuesto para Pablo'),
    ).toBe('create_task');
  });
});

describe('parseCreatePresupuestoRequest', () => {
  it('extracts client and assignee', () => {
    const parsed = parseCreatePresupuestoRequest(
      'Creá un presupuesto para Pablo y asignalo a Juli',
    );
    expect(parsed.clientLabel).toBe('Pablo');
    expect(parsed.assigneeName).toBe('Juli');
    expect(parsed.title).toMatch(/Pablo/i);
    expect(wantsCreatePresupuestoAction('Creá un presupuesto para Pablo')).toBe(true);
    expect(
      wantsCreatePresupuestoAction('Creá una tarea para crear presupuesto para Pablo'),
    ).toBe(false);
  });

  it('creates presupuesto+task requests with product grams and assignee', () => {
    const question =
      'Crea un presupuesto con 500 gramos de castaña de caju. Crea una tarea y asígnalo a Juan para trabajar sobre el presupuesto que creaste';

    expect(wantsCreatePresupuestoAction(question)).toBe(true);
    expect(inferCopiActionType(question)).toBe('create_presupuesto');

    const parsed = parseCreatePresupuestoRequest(question);
    expect(parsed.assigneeName).toBe('Juan');
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0]?.grams).toBe(500);
    expect(parsed.lines[0]?.productQuery.toLocaleLowerCase('es-AR')).toMatch(/casta/);
    expect(parsed.clientLabel).toBe('Estandar');
  });
});

describe('recoverCreateTaskProposal', () => {
  it('recovers snooze proposals that only stored question + null taskId', () => {
    const question =
      'Crear 3 tareas: 1. Para notificar a juli para retirar el pedido. 2. Tarea para crear paquetes de harina 500 gramos y asignarlo a neto, 3. Mañana por la mañana hacer pedido para comprar leche';

    const recovered = recoverCreateTaskProposal('snooze_task', {
      question,
      taskId: null,
    });

    expect(recovered.actionType).toBe('create_task');
    const items = readTaskItems(recovered.payload);
    expect(items).toHaveLength(3);
    expect(items[0]?.title).toMatch(/notificar/i);
    expect(items[1]?.title).toMatch(/harina/i);
    expect(items[1]?.title).not.toMatch(/asignarlo|neto/i);
    expect(items[1]?.assigneeName?.toLocaleLowerCase('es-AR')).toBe('neto');
    expect(items[2]?.title).toMatch(/pedido|leche/i);
    expect(items[2]?.title).not.toBe('Mañana');
  });

  it('recovers from description when question is missing', () => {
    const recovered = recoverCreateTaskProposal('snooze_task', {
      description: 'Crear una tarea para llamar a María mañana',
      taskId: null,
    });

    expect(recovered.actionType).toBe('create_task');
    expect(readTaskItems(recovered.payload)).toHaveLength(1);
  });

  it('leaves real snooze proposals alone when a task id is present', () => {
    const recovered = recoverCreateTaskProposal('snooze_task', {
      question: 'Posponé la tarea',
      taskId: '355ecade-a5a7-4942-bec4-12327abb6b22',
    });

    expect(recovered.actionType).toBe('snooze_task');
    expect(recovered.payload.taskId).toBe('355ecade-a5a7-4942-bec4-12327abb6b22');
  });

  it('recovers misclassified presupuesto creates', () => {
    const recovered = recoverCreateTaskProposal('snooze_task', {
      question: 'Creá un presupuesto para María y asignalo a Beto',
      taskId: null,
    });

    expect(recovered.actionType).toBe('create_presupuesto');
    expect(recovered.payload.clientLabel).toBe('María');
    expect(recovered.payload.assigneeName).toBe('Beto');
  });
});

describe('parseCreateTaskItems mañana scheduling', () => {
  it('treats “mañana por la mañana” as tomorrow morning, not today', () => {
    const tasks = parseCreateTaskItems(
      'Mañana por la mañana hacer pedido para comprar leche',
      'America/Argentina/Cordoba',
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toMatch(/hacer pedido|comprar leche/i);
    expect(tasks[0]?.dueAt).toBeTruthy();

    const due = new Date(tasks[0]!.dueAt!);
    const now = new Date();
    expect(due.getTime()).toBeGreaterThan(now.getTime() - 60 * 60 * 1000);
  });
});

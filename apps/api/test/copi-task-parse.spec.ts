import { describe, expect, it } from 'vitest';

import { parseCreateTaskItems } from '../src/domains/ai/copi-task-parse';

describe('parseCreateTaskItems', () => {
  it('splits numbered create-task requests into cleaned titles', () => {
    const question =
      'Hola Copi, Necesito que creas dos tareas. 1. tarea para crear presupuesto para Pablo. 2. tarea para mandar el pedido a juli hoy a la tarde';

    const tasks = parseCreateTaskItems(question, 'America/Argentina/Cordoba');

    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.title).toBe('Crear presupuesto para Pablo');
    expect(tasks[1]?.title).toBe('Mandar el pedido a Juli');
    expect(tasks[1]?.dueAt).toBeTruthy();
    expect(tasks[1]?.remindAt).toBeTruthy();
    expect(tasks[1]?.clarificationQuestion).toMatch(/hora exacta/i);
  });

  it('keeps a single task when there is only one request', () => {
    const tasks = parseCreateTaskItems(
      'Creá una tarea para llamar a María mañana',
      'America/Argentina/Cordoba',
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Llamar a María');
    expect(tasks[0]?.dueAt).toBeTruthy();
  });

  it('keeps the action text when mañana appears mid-sentence', () => {
    const tasks = parseCreateTaskItems(
      'Crear 3 tareas: 1. Para notificar a juli. 2. Crear paquetes. 3. Mañana por la mañana hacer pedido para comprar leche',
      'America/Argentina/Cordoba',
    );

    expect(tasks).toHaveLength(3);
    expect(tasks[2]?.title).toMatch(/hacer pedido|leche/i);
    expect(tasks[2]?.title).not.toBe('Mañana');
  });

  it('strips assignment phrases and captures the assignee', () => {
    const tasks = parseCreateTaskItems(
      'Crear 3 tareas: 1. Para notificar a juli para retirar el pedido. 2. Tarea para crear paquetes de harina 500 gramos y asignarlo a Beto, 3. Mañana antes de las 11 am hacer pedido para comprar leche',
      'America/Argentina/Cordoba',
    );

    expect(tasks).toHaveLength(3);
    expect(tasks[1]?.title).toBe('Crear paquetes de Harina 500 gramos');
    expect(tasks[1]?.title).not.toMatch(/asignarlo|Beto/i);
    expect(tasks[1]?.assigneeName).toBe('Beto');
    expect(tasks[2]?.title).toMatch(/hacer pedido|comprar leche/i);
    expect(tasks[2]?.dueAt).toBeTruthy();
  });
});

import { describe, expect, it } from 'vitest';

import {
  applyAppointmentContextFromHistory,
  normalizeAttendeePhone,
  parseCreateAppointmentRequest,
  parseCreateTaskItems,
  reconcileAppointmentClarifications,
} from '../src/domains/ai/copi-task-parse';

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

  it('parses “asigna una tarea a X para …” into title, assignee, and due', () => {
    const tasks = parseCreateTaskItems(
      'Asigna una tarea a Souv para hablar con Diego mañana a las 10 de la mañana',
      'America/Argentina/Cordoba',
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.assigneeName).toBe('Souv');
    expect(tasks[0]?.title).toBe('Hablar con Diego');
    expect(tasks[0]?.description.toLocaleLowerCase('es-AR')).toMatch(/hablar con diego/);
    expect(tasks[0]?.description).not.toMatch(/Asigna una tarea/i);
    expect(tasks[0]?.dueAt).toBeTruthy();
  });

  it('parses daily/weekly recurrence phrases', () => {
    const daily = parseCreateTaskItems(
      'Creá una tarea para revisar caja cada día a las 9',
      'America/Argentina/Cordoba',
    );
    expect(daily[0]?.recurrenceFreq).toBe('daily');

    const weekly = parseCreateTaskItems(
      'Creá una tarea para comprar leche cada lunes a las 10',
      'America/Argentina/Cordoba',
    );
    expect(weekly[0]?.recurrenceFreq).toBe('weekly');
    expect(weekly[0]?.recurrenceWeekday).toBe(1);
  });

  it('understands polite create-task utterances and afternoon clock times', () => {
    const tasks = parseCreateTaskItems(
      'buen día, crea una tarea por favor para hablar con Beto a las 4 de la tarde, hoy.',
      'America/Argentina/Cordoba',
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Hablar con Beto');
    expect(tasks[0]?.description.toLocaleLowerCase('es-AR')).toMatch(/hablar con beto/);
    expect(tasks[0]?.description.toLocaleLowerCase('es-AR')).not.toMatch(
      /buen d[ií]a|crea una tarea|por favor|a las 4|tarde|hoy/,
    );
    // 16:00 America/Argentina/Cordoba = 19:00Z (no DST).
    expect(tasks[0]?.dueAt).toMatch(/T19:00:00\.000Z$/);
    expect(tasks[0]?.remindAt).toMatch(/T18:30:00\.000Z$/);
  });

  it('treats “4 de la tarde” as 16:00, not 04:00', () => {
    const tasks = parseCreateTaskItems(
      'Creá una tarea para revisar la caja hoy a las 4 de la tarde',
      'America/Argentina/Cordoba',
    );
    expect(tasks[0]?.title.toLocaleLowerCase('es-AR')).toMatch(/revisar.*caja/);
    expect(tasks[0]?.dueAt).toMatch(/T19:00:00\.000Z$/);
  });
});

describe('parseCreateAppointmentRequest', () => {
  it('extracts title, schedule, and attendee email', () => {
    const parsed = parseCreateAppointmentRequest(
      'Agendá un turno con María mañana a las 10, correo maria@ejemplo.com',
      'America/Argentina/Cordoba',
    );

    expect(parsed.attendeeEmail).toBe('maria@ejemplo.com');
    expect(parsed.startsAt).toBeTruthy();
    expect(parsed.endsAt).toBeTruthy();
    expect(parsed.title.toLocaleLowerCase('es-AR')).toMatch(/maría|maria/);
    expect(parsed.clarificationQuestions).toHaveLength(0);
  });

  it('asks for Para email when missing', () => {
    const parsed = parseCreateAppointmentRequest(
      'Agendá una cita con Juan mañana a las 15',
      'America/Argentina/Cordoba',
    );

    expect(parsed.attendeeEmail).toBeNull();
    expect(parsed.startsAt).toBeTruthy();
    expect(parsed.clarificationQuestions.some((item) => /correo|Para|tel[eé]fono/i.test(item))).toBe(
      true,
    );
  });

  it('asks for schedule when missing', () => {
    const parsed = parseCreateAppointmentRequest(
      'Agendá un turno con Ana, ana@ejemplo.com',
      'America/Argentina/Cordoba',
    );

    expect(parsed.attendeeEmail).toBe('ana@ejemplo.com');
    expect(parsed.startsAt).toBeNull();
    expect(parsed.clarificationQuestions.some((item) => /cuándo|cuando/i.test(item))).toBe(
      true,
    );
  });
});

describe('appointment history + clarifications', () => {
  it('drops clarifications when startsAt and Para are already filled', () => {
    expect(
      reconcileAppointmentClarifications({
        attendeePhone: '5491138617148',
        startsAt: '2026-09-19T22:00:00.000Z',
        title: 'Degustación de café con Souvik',
      }),
    ).toEqual([]);
  });

  it('treats LLM phone placeholders as missing Para', () => {
    expect(normalizeAttendeePhone("Souvik's phone number from WhatsApp contact")).toBeNull();
    expect(normalizeAttendeePhone('5491138617148')).toBe('5491138617148');
    expect(normalizeAttendeePhone('+54 9 11 3861-7148')).toBe('5491138617148');

    expect(
      reconcileAppointmentClarifications({
        attendeePhone: "Souvik's phone number from WhatsApp contact",
        startsAt: '2026-09-21T22:00:00.000Z',
        title: 'Degustación de café con Souvik',
      }),
    ).toEqual([expect.stringMatching(/correo|Para|tel[eé]fono/i)]);
  });

  it('fills schedule and notes from Copi history for ese horario / ese mensaje', () => {
    const enriched = applyAppointmentContextFromHistory({
      history: [
        {
          body: 'Te propongo enviar este mensaje al cliente por WhatsApp:\n\n«Podemos coordinar la degustación de café para mañana a las 7 de la tarde. ¿Te parece bien?»\n\n¿Lo envío?',
          role: 'assistant',
        },
        {
          body: 'Listo. Envié al cliente por WhatsApp:\n\n«Podemos coordinar la degustación de café para mañana a las 7 de la tarde. ¿Te parece bien?»',
          role: 'assistant',
        },
      ],
      payload: {
        attendeePhone: null,
        clarificationQuestions: [
          '¿Para cuándo agendo «Ese horario conmigo en nuestra . agrega ese»?',
          '¿Cuál es el correo o teléfono de la persona (Para)…?',
        ],
        notes: null,
        question: 'Agenda un turno para ese horario conmigo. Agrega ese mensaje en notas',
        startsAt: '2023-10-06T19:00:00',
        title: 'Ese horario conmigo en nuestra . agrega ese',
      },
      question: 'Agenda un turno para ese horario conmigo. Agrega ese mensaje en notas',
      timezone: 'America/Argentina/Cordoba',
    });

    expect(String(enriched.notes)).toMatch(/degustación de café para mañana a las 7/i);
    expect(enriched.startsAt).toBeTruthy();
    expect(new Date(String(enriched.startsAt)).getFullYear()).toBeGreaterThanOrEqual(2026);
    expect(String(enriched.title)).toMatch(/degust/i);
    expect(enriched.clarificationQuestions).toEqual([
      expect.stringMatching(/correo|Para|tel[eé]fono/i),
    ]);
  });
});

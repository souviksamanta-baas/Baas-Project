import { describe, expect, it } from 'vitest';

import {
  applyChainContextToActionPayload,
  buildChainContextBrief,
} from '../src/domains/ai/copi-chain-context';

describe('copi-chain-context', () => {
  const history = [
    {
      body: 'Te propongo enviar este mensaje al cliente por WhatsApp:\n\n«Podemos coordinar la degustación de café para mañana a las 7 de la tarde. ¿Te parece bien?»\n\n¿Lo envío?',
      role: 'assistant' as const,
    },
    {
      body: 'Listo. Envié al cliente por WhatsApp:\n\n«Podemos coordinar la degustación de café para mañana a las 7 de la tarde. ¿Te parece bien?»',
      role: 'assistant' as const,
    },
  ];

  it('builds a chain brief that surfaces quoted WhatsApp text', () => {
    const brief = buildChainContextBrief(history);
    expect(brief).toMatch(/Ongoing Copi chain/i);
    expect(brief).toMatch(/degustación de café para mañana a las 7/i);
  });

  it('applies ese mensaje context to create_task descriptions', () => {
    const payload = applyChainContextToActionPayload({
      actionType: 'create_task',
      history,
      payload: { description: 'Seguimiento', title: 'Seguimiento' },
      question: 'Creá una tarea y agregá ese mensaje en la descripción',
      timezone: 'America/Argentina/Cordoba',
    });

    expect(String(payload.description)).toMatch(/degustación de café/i);
  });
});

import { routes } from '../navigation/routes';

/** Maps Copi navigate_to route keys to Expo Router paths. */
export function resolveCopiNavigateRoute(
  route: string,
  params: Record<string, unknown> = {},
): string | null {
  const key = route.trim().toLowerCase();
  switch (key) {
    case 'caja':
    case 'cash':
      return routes.cashBalances;
    case 'agenda':
    case 'appointments':
      return routes.appointments;
    case 'productos':
    case 'inventory':
    case 'stock':
      return routes.inventoryManageStock;
    case 'chats':
    case 'inbox':
      if (typeof params.conversationId === 'string' && params.conversationId) {
        return `/inbox/${params.conversationId}`;
      }
      return routes.appInbox;
    case 'presupuestos':
    case 'billing':
      return routes.presupuestos;
    case 'tareas':
    case 'tasks':
      return routes.tasks;
    case 'home':
      return routes.appHome;
    default:
      return null;
  }
}

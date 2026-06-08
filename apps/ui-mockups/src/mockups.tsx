import { useMemo, useState, type ReactElement, type ReactNode } from 'react';

type Surface = 'mobile' | 'desktop';

interface MockupRoute {
  id: string;
  label: string;
  sourceFile: string;
  surface: Surface;
}

const mobileRoutes: MockupRoute[] = [
  { id: 'mobile-home', label: 'Inicio', sourceFile: 'Inicio.png', surface: 'mobile' },
  {
    id: 'mobile-branches',
    label: 'Inicio sucursales',
    sourceFile: 'inicio___sucursales_nexolia_logo.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-inbox',
    label: 'Inbox',
    sourceFile: 'inbox_nexolia_logo.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-thread',
    label: 'Conversacion',
    sourceFile: 'inbox_extended_nexolia_logo.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-copi',
    label: 'Copi',
    sourceFile: 'copi_nexolia_logo.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-copi-chat',
    label: 'Copi chat',
    sourceFile: 'copi_extended_nexolia_logo.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-notifications',
    label: 'Notificaciones',
    sourceFile: 'notifications_nexolia_logo.png',
    surface: 'mobile',
  },
  { id: 'mobile-more', label: 'Mas', sourceFile: 'Menu - Mas.png', surface: 'mobile' },
  { id: 'mobile-account', label: 'Mi cuenta', sourceFile: 'Mi cuenta.png', surface: 'mobile' },
];

const desktopRoutes: MockupRoute[] = [
  { id: 'desktop-home', label: 'Inicio', sourceFile: 'Inicio.png', surface: 'desktop' },
  {
    id: 'desktop-branches',
    label: 'Inicio sucursales',
    sourceFile: 'Inicio_Sucursales.png',
    surface: 'desktop',
  },
  { id: 'desktop-inbox', label: 'Inbox', sourceFile: 'Inbox.png', surface: 'desktop' },
  {
    id: 'desktop-thread',
    label: 'Conversacion',
    sourceFile: 'Inbox - extended.png',
    surface: 'desktop',
  },
  { id: 'desktop-copi', label: 'Copi', sourceFile: 'Copi.png', surface: 'desktop' },
  {
    id: 'desktop-copi-chat',
    label: 'Copi chat',
    sourceFile: 'Copi - extended.png',
    surface: 'desktop',
  },
  {
    id: 'desktop-notifications',
    label: 'Notificaciones',
    sourceFile: 'Notificaciones.png',
    surface: 'desktop',
  },
  { id: 'desktop-more', label: 'Mas', sourceFile: 'Menu - Mas.png', surface: 'desktop' },
  { id: 'desktop-account', label: 'Mi cuenta', sourceFile: 'Mi cuenta.png', surface: 'desktop' },
];

const conversations = [
  ['Maria Gonzalez', 'Hola, tienen disponible el producto...?', 'WhatsApp', '11:32', 'Nuevo lead'],
  ['@tiendabaas', 'Hacen envios a domicilio?', 'Instagram', '10:48', 'Nuevo lead'],
  ['Carlos Ramirez', 'Perfecto, enviame la cotizacion', 'Facebook', '09:15', 'Seguimiento'],
  ['Laura Martinez', 'Me pueden enviar la factura?', 'Email', 'Ayer', 'Cliente'],
  ['+54 9 11 2345-6789', 'Buenas, hacen envios a todo el pais?', 'WhatsApp', 'Ayer', 'Nuevo lead'],
];

const alerts = [
  ['!', 'El producto Camiseta Basica esta con bajo stock (2 unidades).', 'Hoy', 'danger'],
  ['bell', 'Tenes 7 seguimientos pendientes por realizar.', 'Hoy', 'warning'],
  ['wa', 'Maria Gonzalez respondio por WhatsApp.', 'Hace 10 min', 'success'],
  ['bot', 'Copi detecto 3 tareas prioritarias.', 'Hoy', 'purple'],
  ['$', 'Meta semanal: 62% completada.', 'Ayer', 'info'],
];

const questions = [
  'Que necesita mi atencion hoy?',
  'Cuanto vendi este mes?',
  'Quien me debe dinero?',
  'Que productos tienen bajo stock?',
  'Que producto tiene mayor margen?',
];

export function App(): ReactElement {
  const [surface, setSurface] = useState<Surface>('mobile');
  const routes = surface === 'mobile' ? mobileRoutes : desktopRoutes;
  const [routeId, setRouteId] = useState(routes[0]?.id ?? 'mobile-home');
  const activeRoute = useMemo(
    () => routes.find((route) => route.id === routeId) ?? routes[0],
    [routeId, routes],
  );

  function changeSurface(nextSurface: Surface): void {
    setSurface(nextSurface);
    setRouteId(nextSurface === 'mobile' ? mobileRoutes[0].id : desktopRoutes[0].id);
  }

  return (
    <main className="min-h-screen bg-[#eef3f0] px-6 py-8 text-brand-navy">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-primary">
              Nexolia mockups
            </p>
            <h1 className="mt-2 text-3xl font-bold">Mobile and desktop UI screens</h1>
            <p className="mt-1 text-brand-slate">
              Static React, Tailwind, and HTML prototypes based on the provided image mockups.
            </p>
          </div>
          <div className="flex rounded-full border border-brand-border bg-white p-1 shadow-card">
            <button
              className={surfaceButtonClass(surface === 'mobile')}
              onClick={() => changeSurface('mobile')}
              type="button"
            >
              Mobile
            </button>
            <button
              className={surfaceButtonClass(surface === 'desktop')}
              onClick={() => changeSurface('desktop')}
              type="button"
            >
              Desktop
            </button>
          </div>
        </header>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {routes.map((route) => (
            <button
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                route.id === activeRoute.id
                  ? 'border-brand-primary bg-brand-primary text-white'
                  : 'border-brand-border bg-white text-brand-slate'
              }`}
              key={route.id}
              onClick={() => setRouteId(route.id)}
              type="button"
            >
              {route.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[32px] bg-white p-4 shadow-card">
            <p className="mb-3 text-sm font-semibold text-brand-slate">
              Source image: <span className="text-brand-navy">{activeRoute.sourceFile}</span>
            </p>
            {surface === 'mobile' ? (
              <MobileFrame routeId={activeRoute.id} />
            ) : (
              <DesktopFrame routeId={activeRoute.id} />
            )}
          </section>
          <aside className="rounded-[28px] bg-white p-5 shadow-card">
            <h2 className="text-xl font-bold">Review notes</h2>
            <p className="mt-2 text-sm leading-6 text-brand-slate">
              These prototypes intentionally use static representative data so layout, hierarchy,
              and component behavior can be reviewed before binding more production logic.
            </p>
            <div className="mt-5 space-y-3 text-sm">
              <InfoRow label="Surface" value={surface} />
              <InfoRow label="Route" value={activeRoute.id} />
              <InfoRow label="Reference" value={activeRoute.sourceFile} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function surfaceButtonClass(active: boolean): string {
  return `rounded-full px-5 py-2 text-sm font-bold ${
    active ? 'bg-brand-primary text-white' : 'text-brand-slate'
  }`;
}

function InfoRow(props: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-2xl border border-brand-border p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-slate">
        {props.label}
      </p>
      <p className="mt-1 font-semibold text-brand-navy">{props.value}</p>
    </div>
  );
}

function MobileFrame(props: { routeId: string }): ReactElement {
  return (
    <div className="mx-auto h-[852px] w-[393px] overflow-hidden rounded-[46px] border border-brand-border bg-brand-background shadow-dock">
      <div className="flex h-full flex-col">
        <MobileStatusBar />
        <div className="flex-1 overflow-hidden px-6 pb-2">
          <MobileHeader dropdown={props.routeId === 'mobile-branches'} />
          <MobileRoute routeId={props.routeId} />
        </div>
        <BottomNav active={mobileActiveTab(props.routeId)} />
      </div>
    </div>
  );
}

function DesktopFrame(props: { routeId: string }): ReactElement {
  return (
    <div className="mx-auto h-[820px] max-w-[1180px] overflow-hidden rounded-[32px] border border-brand-border bg-brand-background shadow-dock">
      <div className="flex h-full">
        <DesktopSidebar active={desktopActiveTab(props.routeId)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DesktopHeader dropdown={props.routeId === 'desktop-branches'} />
          <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
            <DesktopRoute routeId={props.routeId} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileStatusBar(): ReactElement {
  return (
    <div className="flex items-center justify-between px-7 pt-3 text-sm font-bold">
      <span>9:41</span>
      <span className="tracking-widest">cell wifi battery</span>
    </div>
  );
}

function MobileHeader(props: { dropdown: boolean }): ReactElement {
  return (
    <div className="relative mt-4 flex items-start justify-between">
      <div>
        <p className="text-[27px] font-light tracking-[0.25em]">nexolia</p>
        <p className="text-[11px] text-brand-slate">Tu negocio, mas inteligente</p>
      </div>
      <div className="flex items-center gap-4 text-2xl">
        <IconBubble label="bell" dot />
        <IconBubble label="store" />
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-100 to-stone-200" />
      </div>
      {props.dropdown ? <BranchDropdown compact /> : null}
    </div>
  );
}

function DesktopHeader(props: { dropdown: boolean }): ReactElement {
  return (
    <div className="relative flex items-center justify-between px-8 py-6">
      <div>
        <p className="text-[30px] font-light tracking-[0.25em]">nexolia</p>
        <p className="text-xs text-brand-slate">Tu negocio, mas inteligente</p>
      </div>
      <div className="flex items-center gap-5 text-2xl">
        <IconBubble label="bell" dot />
        <IconBubble label="store" />
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-orange-100 to-stone-200" />
      </div>
      {props.dropdown ? <BranchDropdown /> : null}
    </div>
  );
}

function IconBubble(props: { dot?: boolean; label: string }): ReactElement {
  return (
    <div className="relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold">
      {props.label}
      {props.dot ? <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-brand-primary" /> : null}
    </div>
  );
}

function MobileRoute(props: { routeId: string }): ReactElement {
  if (props.routeId === 'mobile-inbox') return <InboxScreen compact />;
  if (props.routeId === 'mobile-thread') return <ThreadScreen compact />;
  if (props.routeId === 'mobile-copi') return <CopiLanding compact />;
  if (props.routeId === 'mobile-copi-chat') return <CopiChat compact />;
  if (props.routeId === 'mobile-notifications') return <NotificationsScreen compact />;
  if (props.routeId === 'mobile-more') return <MoreScreen compact />;
  if (props.routeId === 'mobile-account') return <AccountScreen compact />;
  return <HomeScreen compact />;
}

function DesktopRoute(props: { routeId: string }): ReactElement {
  if (props.routeId === 'desktop-inbox') return <InboxScreen />;
  if (props.routeId === 'desktop-thread') return <ThreadScreen />;
  if (props.routeId === 'desktop-copi') return <CopiLanding />;
  if (props.routeId === 'desktop-copi-chat') return <CopiChat />;
  if (props.routeId === 'desktop-notifications') return <NotificationsScreen />;
  if (props.routeId === 'desktop-more') return <MoreScreen />;
  if (props.routeId === 'desktop-account') return <AccountScreen />;
  return <HomeScreen />;
}

function HomeScreen(props: { compact?: boolean }): ReactElement {
  return (
    <ScreenStack compact={props.compact}>
      <Title title="Hola Juli!" subtitle="En que puedo ayudarte hoy?" />
      <AssistantCard />
      <SummaryCard />
      <SectionTitle action="Ver todas" title="Conversaciones recientes" />
      <Card>
        {conversations.slice(0, props.compact ? 4 : 5).map((conversation) => (
          <ConversationRow conversation={conversation} key={conversation[0]} />
        ))}
      </Card>
      <InventoryCta />
      <SectionTitle action="Ver todas" title="Alertas recientes" />
      <Card>
        {alerts.slice(0, 3).map((alert) => (
          <AlertRow alert={alert} key={alert[1]} />
        ))}
      </Card>
    </ScreenStack>
  );
}

function InboxScreen(props: { compact?: boolean }): ReactElement {
  return (
    <ScreenStack compact={props.compact}>
      <Title title="Inbox" subtitle="Todas tus conversaciones en un solo lugar" />
      <div className="flex gap-3">
        <div className="flex flex-1 items-center rounded-2xl border border-brand-border bg-white px-4 py-3 text-brand-slate">
          Buscar conversaciones
        </div>
        <button className="rounded-2xl border border-brand-border bg-white px-4 font-bold" type="button">
          filtros
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {['Todos', 'WhatsApp', 'Instagram', 'Facebook', 'Email'].map((channel, index) => (
          <span
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              index === 0 ? 'border-brand-primary bg-brand-primary text-white' : 'border-brand-border bg-white'
            }`}
            key={channel}
          >
            {channel}
          </span>
        ))}
      </div>
      <Card>
        <div className="grid grid-cols-3 border-b border-brand-border text-center text-sm font-semibold text-brand-slate">
          <span className="border-b-2 border-brand-primary py-3 text-brand-primary">Abiertos 12</span>
          <span className="py-3">Pendientes 5</span>
          <span className="py-3">Resueltos 28</span>
        </div>
        {conversations.map((conversation) => (
          <ConversationRow conversation={conversation} key={conversation[0]} unread />
        ))}
      </Card>
    </ScreenStack>
  );
}

function ThreadScreen(props: { compact?: boolean }): ReactElement {
  return (
    <ScreenStack compact={props.compact}>
      <Card>
        <div className="mb-5 flex items-center gap-4">
          <span className="text-3xl">left</span>
          <Avatar label="MG" />
          <div>
            <h2 className="text-2xl font-bold">Maria Gonzalez</h2>
            <p className="text-sm text-brand-slate">Nuevo lead · WhatsApp</p>
          </div>
        </div>
        <div className="space-y-4 bg-[radial-gradient(circle,#dde5ea_1px,transparent_1px)] bg-[length:24px_24px] py-5">
          <MessageBubble body="Hola, tienen disponible el producto Amanda 1kg?" time="11:32" />
          <MessageBubble body="Hola Maria! Si, tenemos stock disponible." outbound time="11:33" />
          <MessageBubble body="Perfecto, cuanto cuesta y hacen envios?" time="11:34" />
          <MessageBubble body="Sale $4.800 y si, hacemos envios a domicilio." outbound time="11:35" />
          <MessageBubble body="Buenisimo, mandame 2 por favor." time="11:36" />
          <MessageBubble body="Claro, te preparo el pedido ahora mismo." outbound time="11:37" />
        </div>
      </Card>
      <ChatInput placeholder="Escribi un mensaje..." />
    </ScreenStack>
  );
}

function CopiLanding(props: { compact?: boolean }): ReactElement {
  return (
    <ScreenStack compact={props.compact}>
      <Title title="Copi" subtitle="Tu asistente IA para el negocio" />
      <AssistantWelcome />
      <ChatInput placeholder="Escribi tu pregunta..." />
      <SectionTitle title="Preguntas sugeridas" />
      <Card>
        {questions.map((question, index) => (
          <ActionRow icon={['check', 'trend', 'user', 'box', '$'][index]} key={question} label={question} />
        ))}
      </Card>
      <SectionTitle title="Resumen rapido" />
      <Card>
        <p>
          Hoy tenes <strong className="text-brand-primary">12 conversaciones</strong> abiertas,{' '}
          <strong className="text-amber-500">3 productos</strong> con bajo stock y{' '}
          <strong className="text-purple-500">4 seguimientos</strong> pendientes.
        </p>
      </Card>
    </ScreenStack>
  );
}

function CopiChat(props: { compact?: boolean }): ReactElement {
  return (
    <ScreenStack compact={props.compact}>
      <Title title="Copi" subtitle="Tu asistente IA para el negocio" />
      <Card>
        <div className="mb-4 flex items-center gap-4">
          <Robot />
          <div>
            <h2 className="text-xl font-bold">Copi</h2>
            <p className="text-brand-slate">Asistente IA</p>
          </div>
        </div>
        <div className="space-y-4">
          <MessageBubble body="Que necesita mi atencion hoy?" outbound time="09:41" />
          <MessageBubble
            body="Hoy tenes 12 conversaciones abiertas, 3 productos con bajo stock y 4 seguimientos pendientes."
            time="09:41"
          />
          <MessageBubble body="Cuales son los productos con bajo stock?" outbound time="09:42" />
          <MessageBubble body="Yerba Amanda 1kg, Leche Entera 1L y Azucar 500g estan por debajo del minimo." time="09:42" />
          <MessageBubble body="Y cuantas ventas hice esta semana?" outbound time="09:43" />
          <MessageBubble body="Llevas $1.250.000 en ventas esta semana. Queres ver el detalle por producto?" time="09:43" />
        </div>
      </Card>
      <ChatInput placeholder="Escribi tu pregunta..." />
    </ScreenStack>
  );
}

function NotificationsScreen(props: { compact?: boolean }): ReactElement {
  return (
    <ScreenStack compact={props.compact}>
      <div className="flex items-end justify-between">
        <Title title="Notificaciones" subtitle="Todo lo que necesita tu atencion" />
        <button className="pb-2 text-sm text-brand-slate" type="button">
          Marcar todas como leidas
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {['Todas', 'No leidas', 'Stock', 'Seguimientos', 'Ventas'].map((filter, index) => (
          <span
            className={`rounded-full border px-5 py-2 text-sm ${
              index === 0 ? 'border-brand-primary text-brand-primary' : 'border-brand-border text-brand-slate'
            }`}
            key={filter}
          >
            {filter}
          </span>
        ))}
      </div>
      <Card>
        {alerts.concat([['bill', '2 clientes tienen facturas vencidas.', 'Ayer', 'info']]).map((alert) => (
          <AlertRow alert={alert} key={alert[1]} large />
        ))}
      </Card>
    </ScreenStack>
  );
}

function MoreScreen(props: { compact?: boolean }): ReactElement {
  return (
    <ScreenStack compact={props.compact}>
      <Title title="Mas" subtitle="Herramientas y accesos de tu negocio" />
      <div className="grid grid-cols-3 gap-3">
        {['Reportes', 'Finanzas', 'Configuracion'].map((label) => (
          <button className="rounded-2xl border border-brand-border bg-white py-3 text-sm font-semibold" key={label} type="button">
            {label}
          </button>
        ))}
      </div>
      <MenuSection
        title="Operacion"
        rows={[
          ['Inventario', 'Stock, productos y movimientos'],
          ['Facturacion', 'Comprobantes y cobros'],
          ['Compras y proveedores', 'Ordenes y abastecimiento'],
          ['Caja', 'Ingresos, egresos y cierre'],
        ]}
      />
      <MenuSection
        title="Crecimiento"
        rows={[
          ['Marketing', 'Promociones, campanas y posteos'],
          ['Portal del cliente', 'Catalogo, reservas y seguimiento'],
          ['Automatizaciones', 'Mensajes, reglas y acciones'],
        ]}
      />
      <MenuSection
        title="Configuracion"
        rows={[
          ['Mi cuenta', 'Perfil, rol y sucursal'],
          ['Integraciones', 'WhatsApp, Instagram y Email'],
          ['Ayuda y soporte', 'Guias y asistencia'],
        ]}
      />
    </ScreenStack>
  );
}

function AccountScreen(props: { compact?: boolean }): ReactElement {
  return (
    <ScreenStack compact={props.compact}>
      <Title title="Mi cuenta" subtitle="Gestiona tu perfil y tu negocio" />
      <Card>
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="h-28 w-28 rounded-full bg-gradient-to-br from-orange-100 to-stone-200" />
            <span className="absolute bottom-1 right-1 rounded-full bg-brand-primary px-3 py-2 text-white">edit</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">Juli Fernandez</h2>
            <p>Almacen Juli <Badge label="Negocio" /></p>
            <p>Sucursal Centro <Badge label="Sucursal" tone="info" /></p>
            <p>Propietaria / Administradora <Badge label="Rol" tone="purple" /></p>
          </div>
        </div>
      </Card>
      <Card>
        {['Editar perfil', 'Cambiar sucursal', 'Usuarios y permisos', 'Configuracion del negocio', 'Notificaciones', 'Ayuda y soporte'].map((row) => (
          <ActionRow icon="user" key={row} label={row} />
        ))}
      </Card>
      <Card>
        <ActionRow icon="out" label="Cerrar sesion" tone="danger" />
      </Card>
      <Card>
        <p>WhatsApp conectado +54 9 351 456-7890 <Badge label="Conectado" /></p>
        <p className="mt-3">Zona horaria: Argentina / Cordoba</p>
      </Card>
    </ScreenStack>
  );
}

function ScreenStack(props: { children: ReactNode; compact?: boolean }): ReactElement {
  return <div className={`space-y-4 ${props.compact ? 'pt-6' : 'pt-2'}`}>{props.children}</div>;
}

function Title(props: { subtitle?: string; title: string }): ReactElement {
  return (
    <div>
      <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em]">{props.title}</h1>
      {props.subtitle ? <p className="mt-1 text-brand-slate">{props.subtitle}</p> : null}
    </div>
  );
}

function Card(props: { children: ReactNode }): ReactElement {
  return <div className="overflow-hidden rounded-[24px] border border-brand-border bg-white p-4 shadow-card">{props.children}</div>;
}

function AssistantCard(): ReactElement {
  return (
    <Card>
      <div className="flex items-center gap-5">
        <Robot />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">Copi - Tu asistente IA</h2>
          <p className="mt-1 text-brand-slate">Preguntame sobre tus ventas, stock, clientes y mas.</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-primary shadow-card">
          chat
        </div>
      </div>
    </Card>
  );
}

function AssistantWelcome(): ReactElement {
  return (
    <Card>
      <div className="flex items-center gap-5">
        <Robot />
        <div>
          <h2 className="text-xl font-bold">Hola! Soy Copi</h2>
          <p className="mt-1 text-brand-slate">Preguntame por ventas, stock, clientes y tareas pendientes.</p>
        </div>
      </div>
    </Card>
  );
}

function SummaryCard(): ReactElement {
  return (
    <Card>
      <h2 className="text-xl font-bold">Resumen del dia</h2>
      <p className="mb-4 text-sm text-brand-slate">Asi va tu negocio hasta ahora. Sigue asi!</p>
      <div className="grid grid-cols-4 divide-x divide-brand-border text-center">
        <Metric color="text-brand-primary" label="Mensajes hoy" value="32" />
        <Metric color="text-amber-500" label="Seguimientos" value="7" />
        <Metric color="text-rose-500" label="Bajo stock" value="3" />
        <Metric color="text-brand-primary" label="Ventas" value="$1.250.000" />
      </div>
    </Card>
  );
}

function Metric(props: { color: string; label: string; value: string }): ReactElement {
  return (
    <div className="px-2">
      <p className={`text-xl font-bold ${props.color}`}>{props.value}</p>
      <p className="text-xs text-brand-slate">{props.label}</p>
    </div>
  );
}

function SectionTitle(props: { action?: string; title: string }): ReactElement {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold">{props.title}</h2>
      {props.action ? <button className="text-sm text-brand-slate" type="button">{props.action}</button> : null}
    </div>
  );
}

function ConversationRow(props: { conversation: string[]; unread?: boolean }): ReactElement {
  const [name, preview, channel, time, status] = props.conversation;
  return (
    <div className="flex items-center gap-3 border-b border-brand-border py-3 last:border-b-0">
      <Avatar label={name.slice(0, 2)} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{name}</p>
        <p className="truncate text-sm text-brand-slate">{preview}</p>
        <p className="text-xs text-brand-primary">{status}</p>
      </div>
      <div className="text-right text-sm text-brand-slate">
        <p>{time}</p>
        {props.unread ? <span className="mt-1 inline-flex rounded-full bg-brand-primary px-2 text-white">2</span> : null}
        <p className="mt-1 text-xs">{channel}</p>
      </div>
    </div>
  );
}

function Avatar(props: { label: string }): ReactElement {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-primary">
      {props.label}
    </div>
  );
}

function InventoryCta(): ReactElement {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft font-bold text-brand-primary">
          box
        </div>
        <div className="flex-1">
          <p className="font-bold">Gestionar stock</p>
          <p className="text-sm text-brand-slate">Revisa tu inventario y actualiza productos</p>
        </div>
        <button className="rounded-xl border border-brand-border px-4 py-2 text-sm font-bold text-brand-primary" type="button">
          Ver inventario
        </button>
      </div>
    </Card>
  );
}

function AlertRow(props: { alert: string[]; large?: boolean }): ReactElement {
  const [icon, text, time, tone] = props.alert;
  const toneClass = {
    danger: 'bg-rose-50 text-rose-500',
    info: 'bg-sky-50 text-sky-500',
    purple: 'bg-purple-50 text-purple-500',
    success: 'bg-emerald-50 text-brand-primary',
    warning: 'bg-amber-50 text-amber-500',
  }[tone] ?? 'bg-brand-soft text-brand-primary';

  return (
    <div className="flex items-center gap-4 border-b border-brand-border py-3 last:border-b-0">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold ${toneClass}`}>
        {icon}
      </span>
      <p className={`${props.large ? 'font-bold' : 'text-sm'} flex-1`}>{text}</p>
      <span className="text-sm text-brand-slate">{time}</span>
    </div>
  );
}

function MessageBubble(props: { body: string; outbound?: boolean; time: string }): ReactElement {
  return (
    <div className={`flex ${props.outbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[74%] rounded-[22px] px-4 py-3 shadow-card ${props.outbound ? 'bg-green-100' : 'bg-white'}`}>
        <p className="leading-6">{props.body}</p>
        <p className="mt-1 text-right text-xs text-brand-slate">{props.time}</p>
      </div>
    </div>
  );
}

function ChatInput(props: { placeholder: string }): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <button className="flex h-12 w-12 items-center justify-center rounded-full border border-brand-border bg-white text-2xl text-brand-primary" type="button">
        +
      </button>
      <div className="flex-1 rounded-full border border-brand-border bg-white px-5 py-3 text-brand-slate">
        {props.placeholder}
      </div>
      <button className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-white" type="button">
        mic
      </button>
    </div>
  );
}

function ActionRow(props: { icon: string; label: string; tone?: 'danger' }): ReactElement {
  return (
    <div className="flex items-center gap-4 border-b border-brand-border py-3 last:border-b-0">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${props.tone === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-brand-soft text-brand-primary'}`}>
        {props.icon}
      </span>
      <span className={`flex-1 ${props.tone === 'danger' ? 'text-rose-500' : ''}`}>{props.label}</span>
      <span className="text-brand-primary">right</span>
    </div>
  );
}

function MenuSection(props: { rows: string[][]; title: string }): ReactElement {
  return (
    <div>
      <h2 className="mb-2 font-bold">{props.title}</h2>
      <Card>
        {props.rows.map(([title, subtitle]) => (
          <ActionRow icon="icon" key={title} label={`${title} - ${subtitle}`} />
        ))}
      </Card>
    </div>
  );
}

function Badge(props: { label: string; tone?: 'info' | 'purple' }): ReactElement {
  const toneClass = props.tone === 'purple' ? 'bg-purple-50 text-purple-500' : props.tone === 'info' ? 'bg-sky-50 text-sky-500' : 'bg-brand-soft text-brand-primary';
  return <span className={`ml-2 rounded-md px-2 py-1 text-xs ${toneClass}`}>{props.label}</span>;
}

function Robot(): ReactElement {
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-gradient-to-b from-white to-slate-100 shadow-card">
      <div className="rounded-2xl bg-brand-navy px-4 py-3 text-brand-primary">oo</div>
    </div>
  );
}

function BranchDropdown(props: { compact?: boolean }): ReactElement {
  return (
    <div className={`absolute right-0 top-12 z-10 rounded-2xl border border-brand-border bg-white p-3 shadow-dock ${props.compact ? 'w-56' : 'w-72'}`}>
      {['Sucursal Centro', 'Sucursal Palermo', 'Deposito / Taller'].map((branch, index) => (
        <div className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm ${index === 0 ? 'bg-brand-soft text-brand-primary' : ''}`} key={branch}>
          <span>{branch}</span>
          {index === 0 ? <span>ok</span> : null}
        </div>
      ))}
    </div>
  );
}

function BottomNav(props: { active: string }): ReactElement {
  return (
    <div className="relative mx-3 mb-2 rounded-[28px] border border-brand-border bg-white px-5 py-3 shadow-dock">
      <div className="grid grid-cols-5 items-end text-center text-xs font-semibold">
        {['Inicio', 'Inbox', '$', 'Copi', 'Mas'].map((item) => (
          <div className={props.active === item ? 'text-brand-primary' : 'text-brand-slate'} key={item}>
            <div className={`${item === '$' ? 'mx-auto -mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary text-3xl text-white shadow-dock' : 'text-lg'}`}>
              {item}
            </div>
            <p>{item === '$' ? '' : item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopSidebar(props: { active: string }): ReactElement {
  return (
    <aside className="w-64 border-r border-brand-border bg-white px-5 py-6">
      <p className="text-[28px] font-light tracking-[0.25em]">nexolia</p>
      <p className="mb-8 text-xs text-brand-slate">Tu negocio, mas inteligente</p>
      {['Inicio', 'Inbox', 'Copi', 'Notificaciones', 'Mas', 'Mi cuenta'].map((item) => (
        <div
          className={`mb-2 rounded-2xl px-4 py-3 font-semibold ${
            props.active === item ? 'bg-brand-soft text-brand-primary' : 'text-brand-slate'
          }`}
          key={item}
        >
          {item}
        </div>
      ))}
    </aside>
  );
}

function mobileActiveTab(routeId: string): string {
  if (routeId.includes('inbox') || routeId.includes('thread')) return 'Inbox';
  if (routeId.includes('copi')) return 'Copi';
  if (routeId.includes('more') || routeId.includes('account')) return 'Mas';
  return 'Inicio';
}

function desktopActiveTab(routeId: string): string {
  if (routeId.includes('inbox') || routeId.includes('thread')) return 'Inbox';
  if (routeId.includes('copi')) return 'Copi';
  if (routeId.includes('notifications')) return 'Notificaciones';
  if (routeId.includes('account')) return 'Mi cuenta';
  if (routeId.includes('more')) return 'Mas';
  return 'Inicio';
}

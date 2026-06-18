import { useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import {
  MobileAddStockPixel,
  MobileConfirmPaymentPixel,
  MobileDeleteProductPixel,
  MobileEditProductPixel,
  MobileEditSubproductPixel,
  MobileManageStockPixel,
  MobileProductDetailPixel,
  MobileSellProductsPixel,
} from './inventory-mockups';
import { type InicioStyleControls } from './pixel-primitives';

type Surface = 'mobile' | 'desktop';

interface MockupRoute {
  id: string;
  label: string;
  sourceFile: string;
  surface: Surface;
}

const defaultInicioStyleControls: InicioStyleControls = {
  cardRadius: 14,
  copiTextSize: 10.5,
  greetingSize: 24,
  headerIconStroke: 1.3,
  headerIconSize: 22,
  logoSize: 22,
  metricIconSize: 14,
  metricNumberSize: 11,
  sectionTitleSize: 12,
  subtitleSize: 11,
  taglineSize: 8,
  verticalSpacing: 1,
};

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
  {
    id: 'mobile-manage-stock',
    label: 'Gestionar stock',
    sourceFile: 'Gestionar stock.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-product-detail',
    label: 'Producto',
    sourceFile: 'Productos_granel.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-edit-product',
    label: 'Editar producto',
    sourceFile: 'Editar producto.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-edit-subproduct',
    label: 'Editar subproducto',
    sourceFile: 'Editar subprod.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-add-stock',
    label: 'Agregar stock',
    sourceFile: 'Agregar stock.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-delete-product',
    label: 'Eliminar producto',
    sourceFile: 'Eliminar producto.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-sell-products',
    label: 'Vender productos',
    sourceFile: 'Vender productos.png',
    surface: 'mobile',
  },
  {
    id: 'mobile-confirm-payment',
    label: 'Confirmar cobro',
    sourceFile: 'Confirmar cobro.png',
    surface: 'mobile',
  },
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

const ownerFirstName = 'Juli';

const mockupFeatureVisibility: Record<string, boolean> = {
  accountConnectedServices: true,
  accountDangerActions: true,
  accountProfileCard: true,
  accountSettingsList: true,
  chatComposer: true,
  chatMessages: true,
  chatProfileHeader: true,
  copiChatComposer: true,
  copiChatMessages: true,
  copiChatProfileHeader: true,
  copiInput: true,
  copiQuickSummary: true,
  copiSuggestedQuestions: true,
  copiWelcomeCard: true,
  footerNav: true,
  headerActions: true,
  homeAlerts: true,
  homeAssistantCard: true,
  homeConversations: true,
  homeInventoryCta: true,
  homeSummary: true,
  inboxChannelFilters: true,
  inboxSearch: true,
  inboxTabsAndList: true,
  moreGrowthSection: true,
  moreOperationsSection: true,
  moreQuickActions: true,
  moreSettingsSection: true,
  notificationsFilters: true,
  notificationsList: true,
};

function FeatureGate(props: { children: ReactNode; feature: string }): ReactElement | null {
  return mockupFeatureVisibility[props.feature] === false ? null : <>{props.children}</>;
}

export function App(): ReactElement {
  const [surface, setSurface] = useState<Surface>('mobile');
  const [inicioStyles, setInicioStyles] = useState<InicioStyleControls>(defaultInicioStyleControls);
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
          {surface === 'mobile' ? <ReferencePanel route={activeRoute} /> : null}
          <section className="rounded-[32px] bg-white p-4 shadow-card">
            <p className="mb-3 text-sm font-semibold text-brand-slate">
              Source image: <span className="text-brand-navy">{activeRoute.sourceFile}</span>
            </p>
            {surface === 'mobile' ? (
              <MobileFrame inicioStyles={inicioStyles} routeId={activeRoute.id} />
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
            {surface === 'mobile' && activeRoute.id === 'mobile-home' ? (
              <InicioStyleControlsPanel
                onChange={(key, value) =>
                  setInicioStyles((current) => ({
                    ...current,
                    [key]: value,
                  }))
                }
                onReset={() => setInicioStyles(defaultInicioStyleControls)}
                values={inicioStyles}
              />
            ) : null}
          </aside>
        </div>
      </div>
      {surface === 'mobile' && activeRoute.id === 'mobile-home' ? (
        <div className="fixed right-5 top-5 z-50 max-h-[calc(100vh-40px)] w-[330px] overflow-y-auto rounded-[26px] border-2 border-[#0A9E56] bg-white p-4 shadow-[0_24px_70px_rgba(16,25,53,0.28)]">
          <InicioStyleControlsPanel
            compact
            onChange={(key, value) =>
              setInicioStyles((current) => ({
                ...current,
                [key]: value,
              }))
            }
            onReset={() => setInicioStyles(defaultInicioStyleControls)}
            values={inicioStyles}
          />
        </div>
      ) : null}
    </main>
  );
}

function ReferencePanel(props: { route: MockupRoute }): ReactElement {
  const sourcePath = encodeURI(
    `/@fs/Users/souviksamanta/Documents/Nexolia/Nexolia mocks/Mobile/${props.route.sourceFile}`,
  );

  return (
    <section className="rounded-[32px] bg-white p-4 shadow-card">
      <p className="mb-3 text-sm font-semibold text-brand-slate">
        Target reference: <span className="text-brand-navy">{props.route.sourceFile}</span>
      </p>
      <img
        alt={`${props.route.label} reference`}
        className="mx-auto h-[697px] w-[393px] rounded-[30px] object-cover shadow-card"
        src={sourcePath}
      />
    </section>
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

function InicioStyleControlsPanel(props: {
  compact?: boolean;
  onChange: (key: keyof InicioStyleControls, value: number) => void;
  onReset: () => void;
  values: InicioStyleControls;
}): ReactElement {
  const controls: Array<{
    key: keyof InicioStyleControls;
    label: string;
    max: number;
    min: number;
    step?: number;
  }> = [
    { key: 'logoSize', label: 'Logo size', max: 30, min: 16 },
    { key: 'taglineSize', label: 'Tagline size', max: 12, min: 6, step: 0.5 },
    { key: 'headerIconSize', label: 'Header icon size', max: 28, min: 14 },
    { key: 'headerIconStroke', label: 'Header stroke', max: 2.5, min: 1, step: 0.05 },
    { key: 'greetingSize', label: 'Greeting size', max: 32, min: 18 },
    { key: 'subtitleSize', label: 'Subtitle size', max: 18, min: 10 },
    { key: 'sectionTitleSize', label: 'Section title size', max: 18, min: 10 },
    { key: 'copiTextSize', label: 'Copi text size', max: 14, min: 8, step: 0.5 },
    { key: 'metricIconSize', label: 'Metric icon size', max: 24, min: 12 },
    { key: 'metricNumberSize', label: 'Metric number size', max: 22, min: 11 },
    { key: 'cardRadius', label: 'Card radius', max: 24, min: 8 },
    { key: 'verticalSpacing', label: 'Vertical spacing', max: 1.4, min: 0.75, step: 0.05 },
  ];

  return (
    <div
      className={
        props.compact
          ? 'rounded-[22px] bg-brand-soft p-4'
          : 'mt-6 rounded-[22px] border border-brand-border bg-brand-soft p-4'
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Inicio Style Controls</h3>
          <p className="mt-1 text-xs leading-5 text-brand-slate">
            Adjust these live, then tell me which values to keep.
          </p>
        </div>
        <button
          className="rounded-full border border-brand-border bg-white px-3 py-1 text-xs font-bold text-brand-slate"
          onClick={props.onReset}
          type="button"
        >
          Reset
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {controls.map((control) => (
          <label className="block" key={control.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold">
              <span>{control.label}</span>
              <span className="rounded-full bg-white px-2 py-1 text-brand-primary">
                {props.values[control.key]}
              </span>
            </div>
            <input
              className="w-full accent-[#0A9E56]"
              max={control.max}
              min={control.min}
              onChange={(event) => props.onChange(control.key, Number(event.currentTarget.value))}
              step={control.step ?? 1}
              type="range"
              value={props.values[control.key]}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function MobileFrame(props: { inicioStyles: InicioStyleControls; routeId: string }): ReactElement {
  return (
    <div className="mx-auto h-[697px] w-[393px] overflow-hidden rounded-[30px] border border-brand-border bg-brand-background shadow-dock">
      {props.routeId === 'mobile-home' ? (
        <MobileInicioPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-branches' ? (
        <MobileInicioPixel controls={props.inicioStyles} openBranches />
      ) : props.routeId === 'mobile-inbox' ? (
        <MobileInboxPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-thread' ? (
        <MobileThreadPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-copi' ? (
        <MobileCopiPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-copi-chat' ? (
        <MobileCopiChatPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-notifications' ? (
        <MobileNotificationsPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-more' ? (
        <MobileMorePixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-account' ? (
        <MobileAccountPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-manage-stock' ? (
        <MobileManageStockPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-product-detail' ? (
        <MobileProductDetailPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-edit-product' ? (
        <MobileEditProductPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-edit-subproduct' ? (
        <MobileEditSubproductPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-add-stock' ? (
        <MobileAddStockPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-delete-product' ? (
        <MobileDeleteProductPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-sell-products' ? (
        <MobileSellProductsPixel controls={props.inicioStyles} />
      ) : props.routeId === 'mobile-confirm-payment' ? (
        <MobileConfirmPaymentPixel controls={props.inicioStyles} />
      ) : (
        <div className="flex h-full flex-col">
          <MobileStatusBar />
          <div className="flex-1 overflow-hidden px-6 pb-2">
            <MobileHeader dropdown={props.routeId === 'mobile-branches'} />
            <MobileRoute routeId={props.routeId} />
          </div>
          <BottomNav active={mobileActiveTab(props.routeId)} />
        </div>
      )}
    </div>
  );
}

function MobileInicioPixel(props: { controls: InicioStyleControls; openBranches?: boolean }): ReactElement {
  const cssVars = {
    '--inicio-card-radius': `${props.controls.cardRadius}px`,
    '--inicio-copi-text-size': `${props.controls.copiTextSize}px`,
    '--inicio-greeting-size': `${props.controls.greetingSize}px`,
    '--inicio-header-icon-size': `${props.controls.headerIconSize}px`,
    '--inicio-logo-size': `${props.controls.logoSize}px`,
    '--inicio-metric-icon-size': `${props.controls.metricIconSize}px`,
    '--inicio-metric-number-size': `${props.controls.metricNumberSize}px`,
    '--inicio-section-title-size': `${props.controls.sectionTitleSize}px`,
    '--inicio-subtitle-size': `${props.controls.subtitleSize}px`,
    '--inicio-tagline-size': `${props.controls.taglineSize}px`,
    '--inicio-vertical-spacing': props.controls.verticalSpacing,
  } as CSSProperties;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#fbfcfb] font-sans text-[#101935]"
      style={cssVars}
    >
      <div className="h-full overflow-y-auto pb-[90px]">
      <MobilePixelHeader controls={props.controls} openBranches={props.openBranches} />

      <div className="px-[20px]">
      <section style={{ marginTop: `calc(22px * var(--inicio-vertical-spacing))` }}>
        <h1 className="text-[18px] font-extrabold leading-[22px] tracking-[-0.035em]">
          ¡Hola {ownerFirstName}! <span className="text-[18px]">👋</span>
        </h1>
        <p className="mt-[5px] text-[11px] font-medium text-[#58647d]">
          ¿En qué puedo ayudarte hoy?
        </p>
      </section>

      <FeatureGate feature="homeAssistantCard">
      <section
        className="flex h-[82px] items-center border border-[#dfe7ec] bg-[#f8fbfa] px-[12px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]"
        style={{
          borderRadius: 'var(--inicio-card-radius)',
          marginTop: `calc(22px * var(--inicio-vertical-spacing))`,
        }}
      >
        <div className="relative h-[82px] w-[94px] shrink-0">
          <CopiRobot />
        </div>
        <div className="ml-[2px] min-w-0 flex-1 pr-[8px]">
          <h2 className="text-[13px] font-extrabold leading-[17px] tracking-[-0.02em]">
            Copi - Tu asistente IA
          </h2>
          <p
            className="mt-[4px] max-w-[172px] font-medium leading-[14px] text-[#56627b]"
            style={{ fontSize: 'var(--inicio-copi-text-size)' }}
          >
            Pregúntame sobre tus ventas, stock, clientes y más.
          </p>
        </div>
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white text-[#0bbf68] shadow-[0_8px_18px_rgba(16,25,53,0.08)]">
          <ChatIcon />
        </div>
      </section>
      </FeatureGate>

      <FeatureGate feature="homeSummary">
      <section
        className="border border-[#dfe7ec] bg-white px-[12px] pb-[16px] pt-[13px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]"
        style={{
          borderRadius: 'var(--inicio-card-radius)',
          marginTop: `calc(10px * var(--inicio-vertical-spacing))`,
        }}
      >
        <h2 className="text-[12px] font-semibold leading-[17px]">
          Resumen del día
        </h2>
        <p className="mt-[5px] text-[11px] font-medium text-[#56627b]">Así va tu negocio hasta ahora. ¡Sigue así! 💚</p>
        <div className="mt-[16px] grid grid-cols-4 divide-x divide-[#e5ecf0] text-center">
          <PixelMetric icon={<MessageIcon size="18px" />} label="Mensajes hoy" tone="green" value="32" />
          <PixelMetric icon={<TaskIcon size="18px" />} label="Seguimientos pendientes" tone="orange" value="7" />
          <PixelMetric icon={<BoxIcon size="18px" />} label="Productos con bajo stock" tone="red" value="3" />
          <PixelMetric icon={<MoneyIcon size="18px" />} label="Ventas (Semana)" tone="green" value="$1.250.000" />
        </div>
      </section>
      </FeatureGate>

      <FeatureGate feature="homeConversations">
      <div className="mt-[17px] flex items-center justify-between px-[4px]">
        <h2 className="text-[12px] font-semibold">
          Conversaciones recientes
        </h2>
        <span className="text-[11px] font-medium text-[#51607b]">Ver todas ›</span>
      </div>
      <section className="mt-[8px] overflow-hidden border border-[#e4ebef] bg-white" style={{ borderRadius: 'var(--inicio-card-radius)' }}>
        <PixelConversation avatar="MG" badge="wa" name="María González" preview="Hola, ¿tienen disponible el producto..." time="9:30 a.m." />
        <PixelConversation avatar="TB" badge="ig" name="@tiendabaas" preview="¿Hacen envíos a domicilio?" time="Ayer" />
        <PixelConversation avatar="CR" badge="fb" name="Carlos Ramírez" preview="Gracias, enviado ✅" time="Ayer" />
        <PixelConversation avatar="LM" badge="em" name="Laura Martínez" preview="¿Me pueden enviar la factura?" time="Ayer" />
      </section>
      </FeatureGate>

      <FeatureGate feature="homeInventoryCta">
      <section className="mt-[12px] flex h-[58px] items-center gap-[12px] border border-[#e4ebef] bg-white px-[15px]" style={{ borderRadius: 'var(--inicio-card-radius)' }}>
        <div className="text-[#08bd66]"><BoxIcon size="22px" /></div>
        <div className="flex-1">
          <div className="text-[12px] font-semibold">Gestionar stock</div>
          <div className="mt-[2px] text-[10px] font-medium text-[#56627b]">Revisa tu inventario y actualiza productos</div>
        </div>
        <button className="rounded-[9px] border border-[#dfe7ec] px-[15px] py-[8px] text-[11px] font-extrabold text-[#08b963]" type="button">
          Ver inventario ›
        </button>
      </section>
      </FeatureGate>

      <FeatureGate feature="homeAlerts">
      <div className="mt-[14px] flex items-center justify-between px-[4px]">
        <h2 className="text-[12px] font-semibold">
          Alertas recientes
        </h2>
        <span className="text-[11px] font-medium text-[#51607b]">Ver todas ›</span>
      </div>
      <section className="mt-[8px] overflow-hidden border border-[#f1dfcf] bg-white" style={{ borderRadius: 'var(--inicio-card-radius)' }}>
        <PixelAlert icon="!" text='El producto “Camiseta Básica” está con bajo stock (2 unidades).' time="Hoy" tone="red" />
        <PixelAlert icon="⌂" text="Tienes 7 seguimientos pendientes por realizar." time="Ayer" tone="orange" />
        <PixelAlert icon="$" text="Meta semanal: 62% completado." time="Ayer" tone="blue" />
      </section>
      </FeatureGate>
      </div>
      </div>
      <PixelBottomNav active="Inicio" />
    </div>
  );
}

function MobilePixelHeader(props: { activeNotifications?: boolean; controls: InicioStyleControls; openBranches?: boolean }): ReactElement {
  return (
    <div className="sticky top-0 z-30 bg-[#fbfcfb]/95 px-[20px] pb-[8px] pt-[7px] backdrop-blur">
      <MobilePixelStatusBar />
      <div className="mt-[10px] flex items-start justify-between">
        <div>
          <img alt="Nexolia" className="h-[23px] w-[118px] object-contain object-left" src="/nexolia-logo.svg" />
          <div
            className="mt-[3px] font-normal text-[#53607a]"
            style={{ fontSize: 'var(--inicio-tagline-size)' }}
          >
            Tu negocio, mas inteligente
          </div>
        </div>
        <FeatureGate feature="headerActions">
          <div className="flex items-center gap-[13px] pt-[1px]">
            <div className="relative flex h-[24px] w-[24px] items-center justify-center text-[#101935]">
              <BellIcon size="var(--inicio-header-icon-size)" strokeWidth={props.controls.headerIconStroke} />
              <span className="absolute right-[1px] top-[-2px] h-[5px] w-[5px] rounded-full bg-[#0ac46a]" />
              {props.activeNotifications ? <span className="absolute bottom-[-9px] h-[2px] w-[18px] rounded-full bg-[#08bd66]" /> : null}
            </div>
            <div className="flex h-[24px] items-center gap-[3px] text-[#101935]">
              <StoreIcon size="var(--inicio-header-icon-size)" strokeWidth={props.controls.headerIconStroke} />
              <span className="flex h-[24px] w-[10px] items-center justify-center text-[#101935]">
                <ChevronDownIcon open={props.openBranches} size="12px" strokeWidth={2.1} />
              </span>
            </div>
            <div className="h-[30px] w-[30px] overflow-hidden rounded-full bg-gradient-to-br from-[#f3c5a6] via-[#f0d4c8] to-[#d8b1a0]">
              <div className="mx-auto mt-[5px] h-[23px] w-[18px] rounded-t-full bg-[#8d4c32]" />
            </div>
          </div>
        </FeatureGate>
      </div>
      {props.openBranches ? <PixelBranchesDropdown /> : null}
    </div>
  );
}

function PixelBranchesDropdown(): ReactElement {
  return (
    <div className="absolute right-[10px] top-[72px] z-40 w-[158px] rounded-[12px] border border-[#e2e8ec] bg-white p-[6px] shadow-[0_12px_28px_rgba(16,25,53,0.12)]">
      <PixelBranchOption active icon={<StoreIcon size="16px" strokeWidth={1.7} />} label="Sucursal Centro" />
      <PixelBranchOption icon={<StoreIcon size="16px" strokeWidth={1.7} />} label="Sucursal Palermo" />
      <PixelBranchOption icon={<BranchCenterIcon />} label="Depósito / Taller" />
    </div>
  );
}

function PixelBranchOption(props: { active?: boolean; icon: ReactElement; label: string }): ReactElement {
  return (
    <div
      className={`flex h-[36px] items-center gap-[8px] rounded-[8px] px-[9px] text-[10px] font-medium ${
        props.active ? 'bg-[#eef9f2] text-[#08b963]' : 'text-[#101935]'
      }`}
    >
      <span className={props.active ? 'text-[#08b963]' : 'text-[#101935]'}>
        {props.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      {props.active ? (
        <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#08bd66] text-white">
          <CheckIcon />
        </span>
      ) : null}
    </div>
  );
}

type InboxChannel = 'email' | 'facebook' | 'instagram' | 'whatsapp';
type InboxPillTone = 'blue' | 'green' | 'purple';

interface InboxConversation {
  avatar: 'default' | 'email' | 'man' | 'woman-1' | 'woman-2' | 'woman-3';
  badge: InboxChannel;
  name: string;
  pill?: string;
  pillTone?: InboxPillTone;
  preview: string;
  smart?: boolean;
  time: string;
  unread?: string;
}

const inboxConversations: InboxConversation[] = [
  {
    avatar: 'woman-1',
    badge: 'whatsapp',
    name: 'María González',
    pill: 'Nuevo lead',
    pillTone: 'green',
    preview: 'Hola, ¿tienen disponible el producto...?',
    time: '11:32',
    unread: '2',
  },
  {
    avatar: 'woman-2',
    badge: 'instagram',
    name: '@tiendabaaS',
    preview: '¿Hacen envíos a domicilio?',
    time: '10:48',
    unread: '1',
  },
  {
    avatar: 'man',
    badge: 'facebook',
    name: 'Carlos Ramírez',
    pill: 'Seguimiento',
    pillTone: 'blue',
    preview: 'Perfecto, envíame la cotización',
    smart: true,
    time: '09:15',
  },
  {
    avatar: 'woman-3',
    badge: 'email',
    name: 'Laura Martínez',
    pill: 'Cliente',
    pillTone: 'purple',
    preview: '¿Me pueden enviar la factura?',
    time: 'Ayer',
  },
  {
    avatar: 'default',
    badge: 'whatsapp',
    name: '+54 9 11 2345-6789',
    pill: 'Nuevo lead',
    pillTone: 'green',
    preview: 'Buenas, ¿hacen envíos a todo el país?',
    time: 'Ayer',
    unread: '2',
  },
  {
    avatar: 'email',
    badge: 'email',
    name: 'info@miempresa.com',
    pill: 'Seguimiento',
    pillTone: 'blue',
    preview: 'Consulta sobre disponibilidad de productos',
    smart: true,
    time: 'Lun',
  },
];

function MobileInboxPixel(props: { controls: InicioStyleControls }): ReactElement {
  const cssVars = {
    '--inicio-card-radius': `${props.controls.cardRadius}px`,
    '--inicio-header-icon-size': `${props.controls.headerIconSize}px`,
    '--inicio-tagline-size': `${props.controls.taglineSize}px`,
  } as CSSProperties;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#fbfcfb] font-sans text-[#101935]"
      style={cssVars}
    >
      <div className="h-full overflow-y-auto pb-[84px]">
        <MobilePixelHeader controls={props.controls} />

        <div className="px-[20px]">
          <section className="mt-[8px]">
            <h1 className="text-[18px] font-extrabold leading-[22px] tracking-[-0.025em]">Inbox</h1>
            <p className="mt-[7px] text-[11px] font-medium leading-[14px] text-[#56627b]">
              Todas tus conversaciones en un solo lugar
            </p>
          </section>

          <FeatureGate feature="inboxSearch">
          <section className="mt-[16px] flex gap-[8px]">
            <div className="flex h-[34px] min-w-0 flex-1 items-center gap-[10px] rounded-[9px] border border-[#dfe7ec] bg-white px-[12px] text-[#65708a] shadow-[0_1px_8px_rgba(16,25,53,0.02)]">
              <SearchIcon />
              <span className="text-[11px] font-medium">Buscar conversaciones</span>
            </div>
            <button
              className="flex h-[34px] w-[38px] shrink-0 items-center justify-center rounded-[9px] border border-[#dfe7ec] bg-white text-[#56627b]"
              type="button"
            >
              <FilterIcon />
            </button>
          </section>
          </FeatureGate>

          <FeatureGate feature="inboxChannelFilters">
          <section className="mt-[15px] flex gap-[7px] overflow-hidden">
            <InboxChannelChip active icon={<StackIcon />} label="Todos" />
            <InboxChannelChip icon={<WhatsappIcon />} label="WhatsApp" />
            <InboxChannelChip icon={<InstagramIcon />} label="Instagram" />
            <InboxChannelChip icon={<FacebookIcon />} label="Facebook" />
            <InboxChannelChip icon={<EmailIcon />} label="Email" />
          </section>
          </FeatureGate>

          <FeatureGate feature="inboxTabsAndList">
          <section className="mt-[15px] overflow-hidden rounded-[14px] border border-[#dfe7ec] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
            <div className="grid h-[36px] grid-cols-3 border-b border-[#e7edf1] text-center text-[10px] text-[#56627b]">
              <InboxTab active count="12" label="Abiertos" />
              <InboxTab count="5" label="Pendientes" />
              <InboxTab count="28" label="Resueltos" />
            </div>
            {inboxConversations.map((conversation) => (
              <InboxConversationRow conversation={conversation} key={conversation.name} />
            ))}
          </section>
          </FeatureGate>
        </div>
      </div>

      <PixelBottomNav active="Inbox" />
    </div>
  );
}

const copiSuggestedQuestions = [
  {
    icon: <MessageIcon size="17px" />,
    label: '¿Qué necesita mi atención hoy?',
    tone: 'green',
  },
  {
    icon: <TrendIcon />,
    label: '¿Cuánto vendí este mes?',
    tone: 'orange',
  },
  {
    icon: <PersonDebtIcon />,
    label: '¿Quién me debe dinero?',
    tone: 'red',
  },
  {
    icon: <BoxIcon size="17px" />,
    label: '¿Qué productos tienen bajo stock?',
    tone: 'purple',
  },
  {
    icon: <MoneyIcon size="17px" />,
    label: '¿Qué producto tiene mayor margen?',
    tone: 'blue',
  },
] as const;

function MobileCopiPixel(props: { controls: InicioStyleControls }): ReactElement {
  const cssVars = {
    '--inicio-card-radius': `${props.controls.cardRadius}px`,
    '--inicio-header-icon-size': `${props.controls.headerIconSize}px`,
    '--inicio-tagline-size': `${props.controls.taglineSize}px`,
  } as CSSProperties;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#fbfcfb] font-sans text-[#101935]"
      style={cssVars}
    >
      <div className="h-full overflow-y-auto pb-[88px]">
        <MobilePixelHeader controls={props.controls} />

        <div className="px-[20px]">
          <section className="mt-[8px]">
            <h1 className="text-[18px] font-extrabold leading-[22px] tracking-[-0.025em]">Copi</h1>
            <p className="mt-[7px] text-[11px] font-medium leading-[14px] text-[#56627b]">
              Tu asistente IA para el negocio
            </p>
          </section>

          <FeatureGate feature="copiWelcomeCard">
          <section className="mt-[10px] flex h-[86px] items-center border border-[#dfe7ec] bg-white px-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]" style={{ borderRadius: 'var(--inicio-card-radius)' }}>
            <div className="relative h-[92px] w-[108px] shrink-0">
              <CopiRobot />
            </div>
            <div className="min-w-0 flex-1 pb-[2px]">
              <h2 className="text-[14px] font-extrabold leading-[18px] tracking-[-0.02em]">
                ¡Hola! Soy Copi <span className="text-[14px]">👋</span>
              </h2>
              <p className="mt-[8px] max-w-[195px] text-[11px] font-medium leading-[16px] text-[#56627b]">
                Pregúntame por ventas, stock, clientes y tareas pendientes.
              </p>
            </div>
          </section>
          </FeatureGate>

          <FeatureGate feature="copiInput">
          <section className="mt-[14px]">
            <h2 className="text-[12px] font-semibold leading-[17px]">Escribí tu pregunta</h2>
            <div className="mt-[9px] flex items-center gap-[8px]">
              <button className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full border border-[#dfe7ec] bg-white text-[#08bd66]" type="button">
                <PlusIcon />
              </button>
              <div className="flex h-[36px] min-w-0 flex-1 items-center rounded-full border border-[#dfe7ec] bg-white px-[14px] text-[#9aa4b6] shadow-[0_1px_8px_rgba(16,25,53,0.02)]">
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">Escribí tu pregunta...</span>
                <span className="text-[#08bd66]"><CameraIcon /></span>
              </div>
              <button className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#08bd66] text-white shadow-[0_8px_18px_rgba(8,189,102,0.25)]" type="button">
                <MicIcon />
              </button>
            </div>
          </section>
          </FeatureGate>

          <FeatureGate feature="copiSuggestedQuestions">
          <section className="mt-[18px]">
            <h2 className="text-[12px] font-semibold leading-[17px]">Preguntas sugeridas</h2>
            <div className="mt-[10px] overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
              {copiSuggestedQuestions.map((question) => (
                <CopiSuggestedQuestionRow
                  icon={question.icon}
                  key={question.label}
                  label={question.label}
                  tone={question.tone}
                />
              ))}
            </div>
          </section>
          </FeatureGate>

          <FeatureGate feature="copiQuickSummary">
          <section className="mt-[18px]">
            <h2 className="text-[12px] font-semibold leading-[17px]">Resumen rápido</h2>
            <div className="mt-[10px] flex min-h-[70px] items-center gap-[13px] rounded-[14px] border border-[#e4ebef] bg-white px-[14px] py-[12px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#e9f8ef] text-[#08bd66]">
                <SparkleIcon />
              </span>
              <p className="min-w-0 flex-1 text-[11px] font-medium leading-[16px] text-[#101935]">
                Hoy tenés <strong className="font-extrabold text-[#08bd66]">12 conversaciones</strong> abiertas,
                <strong className="font-extrabold text-[#ff7f2e]"> 3 productos</strong> con bajo stock y
                <strong className="font-extrabold text-[#8b5cf6]"> 4 seguimientos</strong> pendientes.
              </p>
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#e9f8ef] text-[#08bd66]">
                <ChevronRightIcon />
              </span>
            </div>
          </section>
          </FeatureGate>
        </div>
      </div>

      <PixelBottomNav active="Copi" />
    </div>
  );
}

function CopiSuggestedQuestionRow(props: {
  icon: ReactElement;
  label: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'red';
}): ReactElement {
  const toneClass = {
    blue: 'bg-[#eef8ff] text-[#1688e8]',
    green: 'bg-[#e9f8ef] text-[#08bd66]',
    orange: 'bg-[#fff0e4] text-[#ff7f2e]',
    purple: 'bg-[#f2eaff] text-[#8b5cf6]',
    red: 'bg-[#ffeaf0] text-[#ff315f]',
  }[props.tone];

  return (
    <div className="flex h-[38px] items-center gap-[12px] border-b border-[#edf2f4] px-[13px] last:border-b-0">
      <span className={`flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-[8px] ${toneClass}`}>
        {props.icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold leading-[15px]">
        {props.label}
      </span>
      <span className="text-[#08bd66]">
        <ChevronRightIcon />
      </span>
    </div>
  );
}

function MobileThreadPixel(props: { controls: InicioStyleControls }): ReactElement {
  const cssVars = {
    '--inicio-header-icon-size': `${props.controls.headerIconSize}px`,
    '--inicio-tagline-size': `${props.controls.taglineSize}px`,
  } as CSSProperties;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fbfcfb] font-sans text-[#101935]" style={cssVars}>
      <div className="h-full overflow-y-auto pb-[82px]">
        <MobilePixelHeader controls={props.controls} />
        <div className="px-[8px] pt-0">
          <section className="overflow-hidden rounded-[14px] border border-[#eef3f6] bg-white shadow-[0_1px_8px_rgba(16,25,53,0.025)]">
            <FeatureGate feature="chatProfileHeader">
              <div className="sticky top-0 z-20 flex h-[86px] items-center gap-[14px] border-b border-[#edf2f4] bg-white/95 px-[18px] backdrop-blur">
                <span className="text-[#101935]"><ArrowLeftIcon /></span>
                <InboxAvatar avatar="woman-1" badge="whatsapp" />
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[18px] font-extrabold leading-[22px]">María González</h1>
                  <div className="mt-[5px] flex items-center gap-[6px]">
                    <span className="rounded-full bg-[#e9f8ef] px-[8px] py-[2px] text-[10px] font-medium text-[#08bd66]">● Nuevo lead</span>
                    <span className="rounded-full border border-[#dfe7ec] px-[8px] py-[2px] text-[10px] font-medium text-[#101935]">WhatsApp</span>
                  </div>
                  <p className="mt-[4px] text-[10px] font-medium text-[#7b86a0]">Cliente potencial</p>
                </div>
              </div>
            </FeatureGate>
            <FeatureGate feature="chatMessages">
              <div className="pixel-chat-bg min-h-[448px] px-[18px] py-[20px]">
                <PixelChatBubble text="Hola, ¿tienen disponible el producto Amanda 1kg?" time="11:32" />
                <PixelChatBubble outbound text="¡Hola María! Sí, tenemos stock disponible." time="11:33" />
                <PixelChatBubble text="Perfecto, ¿Cuánto cuesta y hacen envíos?" time="11:34" />
                <PixelChatBubble outbound text="Sale $4.800 y sí, hacemos envíos a domicilio." time="11:35" />
                <PixelChatBubble text="Buenísimo, mandame 2 por favor." time="11:36" />
                <PixelChatBubble outbound text="Claro, te preparo el pedido ahora mismo." time="11:37" />
              </div>
            </FeatureGate>
          </section>
        </div>
      </div>
      <FeatureGate feature="chatComposer">
        <PixelComposer placeholder="Escribí un mensaje..." />
      </FeatureGate>
    </div>
  );
}

function MobileCopiChatPixel(props: { controls: InicioStyleControls }): ReactElement {
  const cssVars = {
    '--inicio-header-icon-size': `${props.controls.headerIconSize}px`,
    '--inicio-tagline-size': `${props.controls.taglineSize}px`,
  } as CSSProperties;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fbfcfb] font-sans text-[#101935]" style={cssVars}>
      <div className="h-full overflow-y-auto pb-[82px]">
        <MobilePixelHeader controls={props.controls} />
        <div className="px-[8px] pt-0">
          <section className="overflow-hidden rounded-[14px] border border-[#eef3f6] bg-white shadow-[0_1px_8px_rgba(16,25,53,0.025)]">
            <FeatureGate feature="copiChatProfileHeader">
              <div className="sticky top-0 z-20 flex h-[74px] items-center gap-[14px] border-b border-[#edf2f4] bg-white/95 px-[16px] backdrop-blur">
                <span className="text-[#101935]"><ArrowLeftIcon /></span>
                <CopiRobotAvatar />
                <div className="min-w-0">
                  <h2 className="text-[16px] font-extrabold leading-[19px]">Copi</h2>
                  <p className="mt-[3px] text-[10px] font-medium text-[#56627b]">Asistente IA</p>
                </div>
              </div>
            </FeatureGate>
            <FeatureGate feature="copiChatMessages">
              <div className="pixel-chat-bg px-[18px] py-[20px]">
                <PixelChatBubble outbound text="¿Qué necesita mi atención hoy?" time="09:41" />
                <PixelChatBubble text="Hoy tenés 12 conversaciones abiertas, 3 productos con bajo stock y 4 seguimientos pendientes." time="09:41" />
                <PixelChatBubble outbound text="¿Cuáles son los productos con bajo stock?" time="09:42" />
                <PixelChatBubble text="Yerba Amanda 1kg, Leche Entera 1L y Azúcar 500g están por debajo del mínimo." time="09:42" />
                <PixelChatBubble outbound text="¿Y cuántas ventas hice esta semana?" time="09:43" />
                <PixelChatBubble text="Llevás $1.250.000 en ventas esta semana. ¿Querés ver el detalle por producto?" time="09:43" />
              </div>
            </FeatureGate>
          </section>
        </div>
      </div>
      <FeatureGate feature="copiChatComposer">
        <PixelComposer placeholder="Escribí tu pregunta..." />
      </FeatureGate>
    </div>
  );
}

function MobileNotificationsPixel(props: { controls: InicioStyleControls }): ReactElement {
  const cssVars = {
    '--inicio-header-icon-size': `${props.controls.headerIconSize}px`,
    '--inicio-tagline-size': `${props.controls.taglineSize}px`,
  } as CSSProperties;
  const rows = [
    ['alert', 'red', 'El producto “Camiseta Básica” está con bajo stock (2 unidades).', '', 'Hoy'],
    ['bell', 'orange', 'Tienes 7 seguimientos pendientes por realizar.', '', 'Hoy'],
    ['whatsapp', 'green', 'María González respondió por WhatsApp.', '¿Tienen disponible el producto Amanda 1kg?', 'Hace 10 min'],
    ['bot', 'purple', 'Copi detectó 3 tareas prioritarias.', 'Mensajes sin responder, bajo stock y seguimientos.', 'Hoy'],
    ['money', 'blue', 'Meta semanal: 62% completada.', 'Las ventas subieron frente a la semana pasada.', 'Ayer'],
    ['bill', 'blue', '2 clientes tienen facturas vencidas.', 'Revisa y enviá los recordatorios pendientes.', 'Ayer'],
  ] as const;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fbfcfb] font-sans text-[#101935]" style={cssVars}>
      <div className="h-full overflow-y-auto pb-[88px]">
        <MobilePixelHeader activeNotifications controls={props.controls} />
        <div className="px-[20px] pt-[8px]">
          <div className="flex items-end justify-between gap-[10px]">
            <div>
              <h1 className="text-[18px] font-extrabold leading-[22px] tracking-[-0.025em]">Notificaciones</h1>
              <p className="mt-[7px] text-[11px] font-medium leading-[14px] text-[#56627b]">Todo lo que necesita tu atención</p>
            </div>
            <span className="pb-[2px] text-[10px] font-medium text-[#56627b]">Marcar todas como leídas</span>
          </div>
          <FeatureGate feature="notificationsFilters">
          <div className="mt-[16px] flex gap-[9px] overflow-hidden">
            {['Todas', 'No leídas', 'Stock', 'Seguimientos', 'Ventas'].map((filter, index) => (
              <span className={`flex h-[25px] shrink-0 items-center justify-center rounded-full border px-[15px] text-[10px] font-medium ${index === 0 ? 'border-[#08bd66] text-[#08bd66]' : 'border-[#dfe7ec] text-[#56627b]'}`} key={filter}>
                {filter}
              </span>
            ))}
          </div>
          </FeatureGate>
          <FeatureGate feature="notificationsList">
          <section className="mt-[16px] rounded-[14px] border border-[#e4ebef] bg-white p-[10px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
            {rows.map((row) => (
              <NotificationPixelRow icon={row[0]} key={row[2]} subtitle={row[3]} time={row[4]} title={row[2]} tone={row[1]} />
            ))}
          </section>
          </FeatureGate>
        </div>
      </div>
      <PixelBottomNav />
    </div>
  );
}

function MobileMorePixel(props: { controls: InicioStyleControls }): ReactElement {
  const cssVars = {
    '--inicio-header-icon-size': `${props.controls.headerIconSize}px`,
    '--inicio-tagline-size': `${props.controls.taglineSize}px`,
  } as CSSProperties;
  const groups = [
    { title: 'Operación', rows: [['box', 'Inventario', 'Stock, productos y movimientos'], ['bill', 'Facturación', 'Comprobantes y cobros'], ['cart', 'Compras y proveedores', 'Órdenes y abastecimiento'], ['cash', 'Caja', 'Ingresos, egresos y cierre']] },
    { title: 'Crecimiento', rows: [['megaphone', 'Marketing', 'Promociones, campañas y posteos'], ['users', 'Portal del cliente', 'Catálogo, reservas y seguimiento'], ['bot', 'Automatizaciones', 'Mensajes, reglas y acciones']] },
    { title: 'Configuración', rows: [['user', 'Mi cuenta', 'Perfil, rol y sucursal'], ['puzzle', 'Integraciones', 'WhatsApp, Instagram y Email'], ['help', 'Ayuda y soporte', 'Guías y asistencia']] },
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fbfcfb] font-sans text-[#101935]" style={cssVars}>
      <div className="h-full overflow-y-auto pb-[88px]">
        <MobilePixelHeader controls={props.controls} />
        <div className="px-[20px] pt-[8px]">
          <h1 className="text-[18px] font-extrabold leading-[22px] tracking-[-0.025em]">Más</h1>
          <p className="mt-[7px] text-[11px] font-medium leading-[14px] text-[#56627b]">Herramientas y accesos de tu negocio</p>
          <FeatureGate feature="moreQuickActions">
          <div className="mt-[16px] grid grid-cols-3 gap-[10px]">
            <MoreQuickAction icon="report" label="Reportes" />
            <MoreQuickAction icon="money" label="Finanzas" />
            <MoreQuickAction icon="gear" label="Configuración" />
          </div>
          </FeatureGate>
          {groups.map((group) => (
            <FeatureGate feature={group.title === 'Operación' ? 'moreOperationsSection' : group.title === 'Crecimiento' ? 'moreGrowthSection' : 'moreSettingsSection'} key={group.title}>
            <section className="mt-[14px]" key={group.title}>
              <h2 className="mb-[8px] text-[12px] font-semibold">{group.title}</h2>
              <div className="overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
                {group.rows.map((row) => <SettingsPixelRow icon={row[0]} key={row[1]} subtitle={row[2]} title={row[1]} />)}
              </div>
            </section>
            </FeatureGate>
          ))}
        </div>
      </div>
      <PixelBottomNav active="Mas" />
    </div>
  );
}

function MobileAccountPixel(props: { controls: InicioStyleControls }): ReactElement {
  const cssVars = {
    '--inicio-header-icon-size': `${props.controls.headerIconSize}px`,
    '--inicio-tagline-size': `${props.controls.taglineSize}px`,
  } as CSSProperties;
  const rows = ['Editar perfil', 'Cambiar sucursal', 'Usuarios y permisos', 'Configuración del negocio', 'Notificaciones', 'Ayuda y soporte'];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fbfcfb] font-sans text-[#101935]" style={cssVars}>
      <div className="h-full overflow-y-auto pb-[88px]">
        <MobilePixelHeader controls={props.controls} />
        <div className="px-[20px] pt-[8px]">
          <h1 className="text-[18px] font-extrabold leading-[22px] tracking-[-0.025em]">Mi cuenta</h1>
          <p className="mt-[7px] text-[11px] font-medium leading-[14px] text-[#56627b]">Gestioná tu perfil y tu negocio</p>
          <FeatureGate feature="accountProfileCard">
          <section className="mt-[16px] flex min-h-[128px] items-center gap-[18px] rounded-[14px] border border-[#e4ebef] bg-white px-[18px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
            <div className="relative h-[78px] w-[78px] shrink-0 rounded-full bg-gradient-to-br from-[#f5d1bd] via-[#dca383] to-[#8d4c32]">
              <div className="absolute bottom-[2px] right-[0px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[#08bd66] text-white"><EditIcon /></div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-extrabold leading-[21px]">Juli Fernández</h2>
              <AccountInfoLine icon="store" label="Almacén Juli" pill="Negocio" />
              <AccountInfoLine icon="pin" label="Sucursal Centro" pill="Sucursal" />
              <AccountInfoLine icon="user" label="Propietaria / Administradora" pill="Rol" />
            </div>
          </section>
          </FeatureGate>
          <FeatureGate feature="accountSettingsList">
          <section className="mt-[14px] overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
            {rows.map((row) => <SettingsPixelRow icon={row === 'Editar perfil' ? 'edit' : row === 'Cambiar sucursal' ? 'store' : row === 'Usuarios y permisos' ? 'users' : row === 'Configuración del negocio' ? 'gear' : row === 'Notificaciones' ? 'bell' : 'help'} key={row} title={row} />)}
          </section>
          </FeatureGate>
          <FeatureGate feature="accountDangerActions">
          <section className="mt-[14px] overflow-hidden rounded-[14px] border border-[#f1dfcf] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
            <SettingsPixelRow danger icon="logout" title="Cerrar sesión" />
          </section>
          </FeatureGate>
          <FeatureGate feature="accountConnectedServices">
          <section className="mt-[14px] overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
            <SettingsPixelRow icon="whatsapp" meta="+54 9 351 456-7890" subtitle="Conectado" title="WhatsApp conectado" />
            <SettingsPixelRow icon="globe" title="Zona horaria: Argentina / Córdoba" />
          </section>
          </FeatureGate>
        </div>
      </div>
      <PixelBottomNav active="Mas" />
    </div>
  );
}

function PixelChatBubble(props: { outbound?: boolean; text: string; time: string }): ReactElement {
  return (
    <div className={`mb-[13px] flex ${props.outbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[226px] rounded-[13px] px-[12px] py-[8px] text-[13px] font-medium leading-[18px] shadow-[0_1px_6px_rgba(16,25,53,0.035)] ${props.outbound ? 'bg-[#dcffd9]' : 'border border-[#edf2f4] bg-white'}`}>
        <p>{props.text}</p>
        <div className="mt-[2px] flex items-center justify-end gap-[4px] text-[10px] text-[#7b86a0]">
          <span>{props.time}</span>
          {props.outbound ? <span className="text-[#08bd66]"><DoubleCheckIcon /></span> : null}
        </div>
      </div>
    </div>
  );
}

function PixelComposer(props: { aboveNav?: boolean; placeholder: string }): ReactElement {
  return (
    <div className={`absolute left-0 right-0 z-30 bg-[#fbfcfb]/95 px-[20px] pb-[10px] pt-[8px] ${props.aboveNav ? 'bottom-[64px]' : 'bottom-0'}`}>
      <div className="flex items-center gap-[8px]">
        <button className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full border border-[#dfe7ec] bg-white text-[#08bd66]" type="button"><PlusIcon /></button>
        <div className="flex h-[36px] min-w-0 flex-1 items-center rounded-full border border-[#dfe7ec] bg-white px-[14px] text-[#9aa4b6]">
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{props.placeholder}</span>
          <span className="text-[#08bd66]"><CameraIcon /></span>
        </div>
        <button className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#08bd66] text-white shadow-[0_8px_18px_rgba(8,189,102,0.25)]" type="button"><MicIcon /></button>
      </div>
    </div>
  );
}

function NotificationPixelRow(props: { icon: string; subtitle: string; time: string; title: string; tone: string }): ReactElement {
  return (
    <div className="mb-[10px] flex min-h-[64px] items-center gap-[13px] rounded-[10px] border border-[#edf2f4] bg-white px-[10px] py-[9px] last:mb-0">
      <ToneIcon tone={props.tone}><GlyphIcon kind={props.icon} /></ToneIcon>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-extrabold leading-[16px]">{props.title}</p>
        {props.subtitle ? <p className="mt-[3px] truncate text-[10px] font-medium text-[#56627b]">{props.subtitle}</p> : null}
      </div>
      <div className="flex w-[54px] shrink-0 items-center justify-end gap-[7px] text-[10px] font-medium text-[#56627b]">
        <span>{props.time}</span>
        <span className="h-[6px] w-[6px] rounded-full bg-[#08bd66]" />
      </div>
    </div>
  );
}

function MoreQuickAction(props: { icon: string; label: string }): ReactElement {
  return (
    <button className="flex h-[31px] items-center justify-center gap-[8px] rounded-[10px] border border-[#dfe7ec] bg-white text-[10px] font-extrabold text-[#101935]" type="button">
      <span className="text-[#08bd66]"><GlyphIcon kind={props.icon} /></span>
      <span>{props.label}</span>
    </button>
  );
}

function SettingsPixelRow(props: { danger?: boolean; icon: string; meta?: string; subtitle?: string; title: string }): ReactElement {
  return (
    <div className="flex min-h-[42px] items-center gap-[12px] border-b border-[#edf2f4] px-[12px] py-[8px] last:border-b-0">
      <ToneIcon tone={props.danger ? 'red' : props.icon === 'globe' ? 'blue' : 'green'}><GlyphIcon kind={props.icon} /></ToneIcon>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[11px] font-extrabold leading-[15px] ${props.danger ? 'text-[#ff315f]' : 'text-[#101935]'}`}>{props.title}</p>
        {props.subtitle ? <p className="mt-[2px] truncate text-[9px] font-medium text-[#56627b]">{props.subtitle}</p> : null}
      </div>
      {props.meta ? <span className="shrink-0 text-[11px] font-medium text-[#56627b]">{props.meta}</span> : <span className="text-[#516aa8]"><ChevronRightIcon /></span>}
    </div>
  );
}

function AccountInfoLine(props: { icon: string; label: string; pill: string }): ReactElement {
  return (
    <div className="mt-[8px] flex items-center gap-[8px] text-[10px] font-medium text-[#101935]">
      <span className="text-[#516aa8]"><GlyphIcon kind={props.icon} /></span>
      <span className="min-w-0 truncate">{props.label}</span>
      <span className="rounded-[5px] bg-[#e9f8ef] px-[5px] py-[2px] text-[8px] text-[#08bd66]">{props.pill}</span>
    </div>
  );
}

function ToneIcon(props: { children: ReactElement; tone: string }): ReactElement {
  const className = {
    blue: 'bg-[#eef8ff] text-[#1688e8]',
    green: 'bg-[#e9f8ef] text-[#08bd66]',
    orange: 'bg-[#fff0e4] text-[#ff7f2e]',
    purple: 'bg-[#f2eaff] text-[#8b5cf6]',
    red: 'bg-[#ffeaf0] text-[#ff315f]',
  }[props.tone] ?? 'bg-[#e9f8ef] text-[#08bd66]';

  return <span className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[9px] ${className}`}>{props.children}</span>;
}

function InboxChannelChip(props: { active?: boolean; icon: ReactElement; label: string }): ReactElement {
  return (
    <div
      className={`flex h-[27px] shrink-0 items-center gap-[6px] rounded-full border px-[10px] text-[10px] font-medium ${
        props.active
          ? 'border-[#04bd63] bg-[#04bd63] text-white shadow-[0_5px_12px_rgba(4,189,99,0.22)]'
          : 'border-[#dfe7ec] bg-white text-[#101935]'
      }`}
    >
      {props.icon}
      <span>{props.label}</span>
    </div>
  );
}

function InboxTab(props: { active?: boolean; count: string; label: string }): ReactElement {
  return (
    <div className={`relative flex items-center justify-center gap-[8px] ${props.active ? 'text-[#04bd63]' : ''}`}>
      <span className="font-medium">{props.label}</span>
      <span
        className={`flex h-[15px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[9px] font-extrabold ${
          props.active ? 'bg-[#04bd63] text-white' : 'bg-[#e7edf3] text-[#56627b]'
        }`}
      >
        {props.count}
      </span>
      {props.active ? <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#04bd63]" /> : null}
    </div>
  );
}

function InboxConversationRow(props: { conversation: InboxConversation }): ReactElement {
  const conversation = props.conversation;

  return (
    <div className="flex h-[62px] items-center border-b border-[#edf2f4] px-[14px] last:border-b-0">
      <InboxAvatar avatar={conversation.avatar} badge={conversation.badge} />
      <div className="ml-[14px] min-w-0 flex-1">
        <div className="truncate text-[11px] font-extrabold leading-[15px]">{conversation.name}</div>
        <div className="mt-[1px] truncate text-[10px] font-medium leading-[13px] text-[#56627b]">
          {conversation.preview}
        </div>
        {conversation.pill ? <InboxStatusPill label={conversation.pill} tone={conversation.pillTone ?? 'green'} /> : null}
      </div>
      <div className="ml-[8px] flex w-[36px] shrink-0 flex-col items-end gap-[9px] text-[11px] font-medium text-[#56627b]">
        <span>{conversation.time}</span>
        {conversation.unread ? (
          <span className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#04bd63] px-[5px] text-[10px] font-extrabold text-white">
            {conversation.unread}
          </span>
        ) : conversation.smart ? (
          <span className="text-[#04bd63]"><SparkleIcon /></span>
        ) : null}
      </div>
    </div>
  );
}

function InboxAvatar(props: { avatar: InboxConversation['avatar']; badge: InboxChannel }): ReactElement {
  const avatarClass = {
    default: 'bg-[#dff8e9] text-[#05b85f]',
    email: 'bg-[#e9f0ff] text-[#3978e8]',
    man: 'bg-gradient-to-br from-[#f1d4c0] via-[#d6b39e] to-[#6a4838] text-white',
    'woman-1': 'bg-gradient-to-br from-[#f4d0b8] via-[#dba98d] to-[#8d4c32] text-white',
    'woman-2': 'bg-gradient-to-br from-[#f8c1b5] via-[#da587d] to-[#5c2342] text-white',
    'woman-3': 'bg-gradient-to-br from-[#f8dbc9] via-[#dca586] to-[#9f5f41] text-white',
  }[props.avatar];
  const label = {
    default: '',
    email: '',
    man: 'CR',
    'woman-1': 'MG',
    'woman-2': 'TB',
    'woman-3': 'LM',
  }[props.avatar];

  return (
    <div className={`relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full ${avatarClass}`}>
      {props.avatar === 'default' ? <DefaultPersonIcon /> : props.avatar === 'email' ? <EmailAvatarIcon /> : (
        <span className="text-[10px] font-extrabold">{label}</span>
      )}
      <span className="absolute bottom-[-3px] right-[-4px] flex h-[19px] w-[19px] items-center justify-center overflow-hidden rounded-full border border-white bg-white">
        <ChannelBadgeIcon channel={props.badge} />
      </span>
    </div>
  );
}

function InboxStatusPill(props: { label: string; tone: InboxPillTone }): ReactElement {
  const className = {
    blue: 'bg-[#e8f0ff] text-[#3978e8]',
    green: 'bg-[#e9f8ef] text-[#04a85a]',
    purple: 'bg-[#f0eaff] text-[#6c54c9]',
  }[props.tone];

  return (
    <div className={`mt-[4px] inline-flex items-center gap-[4px] rounded-full px-[6px] py-[1px] text-[9px] font-medium ${className}`}>
      <span className="h-[4px] w-[4px] rounded-full bg-current" />
      <span>{props.label}</span>
    </div>
  );
}

function MobilePixelStatusBar(): ReactElement {
  return (
    <div className="flex h-[16px] items-center justify-between text-[13px] font-extrabold leading-none">
      <span>9:41</span>
      <div className="flex items-center gap-[6px] text-black">
        <IphoneSignalIcon />
        <IphoneWifiIcon />
        <IphoneBatteryIcon />
      </div>
    </div>
  );
}

function IphoneSignalIcon(): ReactElement {
  return (
    <div className="flex h-[11px] w-[17px] items-end gap-[1.5px]">
      <span className="h-[4px] w-[3px] rounded-[1px] bg-black" />
      <span className="h-[6px] w-[3px] rounded-[1px] bg-black" />
      <span className="h-[8px] w-[3px] rounded-[1px] bg-black" />
      <span className="h-[10px] w-[3px] rounded-[1px] bg-black" />
    </div>
  );
}

function IphoneWifiIcon(): ReactElement {
  return (
    <svg fill="none" height="11" viewBox="0 0 17 11" width="17" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 3.8C5.3.9 11.7.9 15.5 3.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M4.5 6.5c2.3-1.7 5.7-1.7 8 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M7.6 9.1c.6-.5 1.2-.5 1.8 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function IphoneBatteryIcon(): ReactElement {
  return (
    <div className="flex items-center">
      <div className="h-[11px] w-[22px] rounded-[3px] border-[1.5px] border-black p-[1.5px]">
        <div className="h-full w-[15px] rounded-[1px] bg-black" />
      </div>
      <span className="ml-[1px] h-[4px] w-[1.5px] rounded-r bg-black" />
    </div>
  );
}

function CopiRobot(): ReactElement {
  return (
    <div className="absolute left-[-7px] top-[-10px] h-[96px] w-[96px] drop-shadow-[0_12px_16px_rgba(16,25,53,0.26)]">
      <div className="absolute left-[47px] top-[11px] h-[8px] w-[2px] rounded-full bg-[#12d47a]" />
      <div className="absolute left-[43px] top-[4px] h-[10px] w-[10px] rounded-full bg-[#12d47a] shadow-[0_0_9px_rgba(18,212,122,0.7)]" />
      <div className="absolute left-[16px] top-[18px] h-[53px] w-[64px] rounded-[28px] bg-gradient-to-b from-white via-[#f5f8fa] to-[#dbe3eb] shadow-[0_9px_20px_rgba(16,25,53,0.18)]">
        <div className="absolute left-[10px] top-[12px] flex h-[28px] w-[44px] items-center justify-around rounded-[15px] bg-[#101935] px-[8px]">
          <span className="h-[8px] w-[8px] rounded-full bg-[#54ffd0] shadow-[0_0_7px_rgba(84,255,208,0.65)]" />
          <span className="h-[8px] w-[8px] rounded-full bg-[#54ffd0] shadow-[0_0_7px_rgba(84,255,208,0.65)]" />
          <span className="absolute bottom-[5px] left-1/2 h-[5px] w-[13px] -translate-x-1/2 rounded-b-full border-b-[2px] border-[#54ffd0]" />
        </div>
      </div>
      <div className="absolute left-[13px] top-[42px] h-[8px] w-[4px] rounded-l-full bg-[#f4f7fa]" />
      <div className="absolute right-[13px] top-[42px] h-[8px] w-[4px] rounded-r-full bg-[#f4f7fa]" />
      <div className="absolute bottom-[3px] left-[24px] h-[33px] w-[47px] rounded-[18px] bg-gradient-to-b from-white to-[#e7edf2] shadow-[0_5px_12px_rgba(16,25,53,0.12)]" />
      <div className="absolute bottom-[14px] left-[16px] h-[24px] w-[13px] -rotate-[18deg] rounded-full bg-gradient-to-b from-white to-[#dfe6ed] shadow-[0_4px_8px_rgba(16,25,53,0.1)]" />
      <div className="absolute bottom-[14px] right-[16px] h-[24px] w-[13px] rotate-[18deg] rounded-full bg-gradient-to-b from-white to-[#dfe6ed] shadow-[0_4px_8px_rgba(16,25,53,0.1)]" />
      <div className="absolute bottom-[18px] left-[38px] flex h-[15px] w-[20px] items-center justify-center rounded-[7px] bg-[#12d47a] text-[7px] text-white">
        ∞
      </div>
    </div>
  );
}

function CopiRobotAvatar(): ReactElement {
  return (
    <div className="relative flex h-[48px] w-[54px] shrink-0 items-center justify-center overflow-visible">
      <div className="relative h-[96px] w-[96px] translate-x-[4px] translate-y-[3px] scale-[0.48]">
        <CopiRobot />
      </div>
    </div>
  );
}

function PixelMetric(props: {
  icon: ReactElement;
  label: string;
  tone: 'green' | 'orange' | 'red';
  value: string;
}): ReactElement {
  const toneClass =
    props.tone === 'green'
      ? 'text-[#08bd66]'
      : props.tone === 'orange'
        ? 'text-[#ff7f2e]'
        : 'text-[#ff315f]';
  const toneBackgroundClass =
    props.tone === 'green'
      ? 'bg-[#e7f8ef]'
      : props.tone === 'orange'
        ? 'bg-[#fff0e4]'
        : 'bg-[#ffeaf0]';

  return (
    <div className="flex min-h-[60px] flex-col px-[7px]">
      <div className={`flex h-[24px] w-[24px] items-center justify-center self-start rounded-full ${toneBackgroundClass} ${toneClass}`}>
        {props.icon}
      </div>
      <div
        className={`pixel-metric-value mt-[6px] w-full text-left font-extrabold leading-[16px] ${toneClass}`}
      >
        {props.value}
      </div>
      <div className="mt-[4px] w-full text-left text-[9px] font-medium leading-[12px] text-[#56627b]">{props.label}</div>
    </div>
  );
}

function PixelConversation(props: {
  avatar: string;
  badge: 'em' | 'fb' | 'ig' | 'wa';
  name: string;
  preview: string;
  time: string;
}): ReactElement {
  const channel = {
    em: 'email',
    fb: 'facebook',
    ig: 'instagram',
    wa: 'whatsapp',
  }[props.badge] as InboxChannel;

  return (
    <div className="flex h-[50px] items-center gap-[10px] border-b border-[#edf2f4] px-[13px] last:border-b-0">
      <div className="relative h-[34px] w-[34px] shrink-0 rounded-full bg-gradient-to-br from-[#f8d7c4] to-[#b96b4e]">
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold text-white">
          {props.avatar}
        </span>
        <span className="absolute bottom-[-3px] right-[-4px] flex h-[19px] w-[19px] items-center justify-center overflow-hidden rounded-full border border-white bg-white">
          <ChannelBadgeIcon channel={channel} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-extrabold leading-[15px]">{props.name}</div>
        <div className="mt-[1px] truncate text-[10px] font-medium leading-[13px] text-[#56627b]">{props.preview}</div>
      </div>
      <div className="w-[56px] text-right text-[10px] font-medium text-[#56627b]">{props.time}</div>
    </div>
  );
}

function PixelAlert(props: {
  icon: string;
  text: string;
  time: string;
  tone: 'blue' | 'orange' | 'red';
}): ReactElement {
  const toneClass =
    props.tone === 'red'
      ? 'bg-[#fff0f3] text-[#ff315f]'
      : props.tone === 'orange'
        ? 'bg-[#fff5e9] text-[#ff8a2a]'
        : 'bg-[#eef8ff] text-[#1692e8]';

  return (
    <div className="flex h-[34px] items-center gap-[11px] border-b border-[#f5e8dc] px-[13px] last:border-b-0">
      <span className={`flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${toneClass}`}>
        {props.icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[#56627b]">{props.text}</span>
      <span className="w-[28px] text-right text-[10px] font-medium text-[#56627b]">{props.time}</span>
      <span className="text-[16px] font-bold text-[#ff8a2a]">›</span>
    </div>
  );
}

function PixelBottomNav(props: { active?: 'Inicio' | 'Inbox' | 'Copi' | 'Mas'; mutedCenter?: boolean }): ReactElement | null {
  if (mockupFeatureVisibility.footerNav === false) return null;

  return (
    <div className="pixel-bottom-nav absolute bottom-0 left-0 right-0 h-[64px] rounded-t-[24px] border border-[#e1e8ec] bg-white shadow-[0_-8px_24px_rgba(16,25,53,0.08)]">
      <div className="grid h-full grid-cols-5 items-center px-[22px] text-center">
        <PixelNavItem active={props.active === 'Inicio'} icon={HomeIcon} label="Inicio" />
        <PixelNavItem active={props.active === 'Inbox'} icon={InboxIcon} label="Inbox" />
        <div className="relative flex justify-center">
          <div className={`absolute bottom-[-20px] flex h-[63px] w-[63px] items-center justify-center rounded-full border-[6px] border-white text-[30px] font-medium shadow-[0_8px_24px_rgba(10,158,86,0.18)] ${props.mutedCenter ? 'bg-white text-[#101935]' : 'bg-[#03bd62] text-white'}`}>
            $
          </div>
        </div>
        <PixelNavItem active={props.active === 'Copi'} icon={BotIcon} label="Copi" />
        <PixelNavItem active={props.active === 'Mas'} icon={MenuIcon} label="Más" />
      </div>
    </div>
  );
}

function PixelNavItem(props: { active?: boolean; icon: (props: { active?: boolean }) => ReactElement; label: string }): ReactElement {
  const Icon = props.icon;

  return (
    <div className={`flex flex-col items-center gap-[3px] text-[10px] font-semibold ${props.active ? 'text-[#08bd66]' : 'text-[#53607a]'}`}>
      <Icon active={props.active} />
      <span>{props.label}</span>
    </div>
  );
}

function SvgIcon(props: {
  children: ReactNode;
  className?: string;
  size?: string;
  strokeWidth?: number | string;
}): ReactElement {
  return (
    <svg
      className={props.className}
      fill="none"
      height={props.size ?? '24'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? '2'}
      viewBox="0 0 24 24"
      width={props.size ?? '24'}
    >
      {props.children}
    </svg>
  );
}

function BellIcon(props: { size?: string; strokeWidth?: number | string }): ReactElement {
  return (
    <SvgIcon className={props.size ? undefined : 'h-[18px] w-[18px]'} size={props.size} strokeWidth={props.strokeWidth ?? 1.3}>
      <path d="M17.5 10.5c0-3.4-2.2-5.8-5.5-5.8s-5.5 2.4-5.5 5.8c0 3.9-1.9 4.9-2.8 6.1h16.6c-.9-1.2-2.8-2.2-2.8-6.1Z" />
      <path d="M9.8 20.1c.5.5 1.2.8 2.2.8s1.7-.3 2.2-.8" />
      <path d="M12 3.2V2.1" />
    </SvgIcon>
  );
}

function StoreIcon(props: { size?: string; strokeWidth?: number | string }): ReactElement {
  return (
    <SvgIcon className={props.size ? undefined : 'h-[22px] w-[22px]'} size={props.size} strokeWidth={props.strokeWidth ?? 1.3}>
      <path d="M5 9.2h14l-1.2-4.7H6.2L5 9.2Z" />
      <path d="M6.5 9.2v10.1h11V9.2" />
      <path d="M9.3 19.3v-5h5.4v5" />
      <path d="M4.9 9.2c.2 1.4 1.2 2.2 2.5 2.2 1.1 0 2-.6 2.4-1.6.4 1 1.3 1.6 2.3 1.6s1.9-.6 2.3-1.6c.4 1 1.3 1.6 2.4 1.6 1.3 0 2.3-.8 2.5-2.2" />
    </SvgIcon>
  );
}

function ChevronDownIcon(props: { open?: boolean; size?: string; strokeWidth?: number | string }): ReactElement {
  return <SvgIcon size={props.size ?? '12'} strokeWidth={props.strokeWidth ?? 2}><path d={props.open ? 'm7 15 5-5 5 5' : 'm7 9 5 5 5-5'} /></SvgIcon>;
}

function SearchIcon(): ReactElement {
  return <SvgIcon className="h-[14px] w-[14px]" strokeWidth={1.8}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></SvgIcon>;
}

function PlusIcon(): ReactElement {
  return <SvgIcon className="h-[17px] w-[17px]" strokeWidth={2}><path d="M12 5v14" /><path d="M5 12h14" /></SvgIcon>;
}

function ArrowLeftIcon(): ReactElement {
  return <SvgIcon className="h-[20px] w-[20px]" strokeWidth={2.2}><path d="M19 12H5" /><path d="m12 5-7 7 7 7" /></SvgIcon>;
}

function DoubleCheckIcon(): ReactElement {
  return <SvgIcon className="h-[13px] w-[13px]" strokeWidth={2}><path d="m2 12 3 3 6-7" /><path d="m9 14 1 1 6-7" /></SvgIcon>;
}

function EditIcon(props: { className?: string } = {}): ReactElement {
  return <SvgIcon className={props.className ?? 'h-[13px] w-[13px]'} strokeWidth={2}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14 8 2 2" /></SvgIcon>;
}

function CameraIcon(): ReactElement {
  return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><path d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="12.6" r="3" /></SvgIcon>;
}

function MicIcon(): ReactElement {
  return <SvgIcon className="h-[20px] w-[20px]" strokeWidth={2.2}><rect height="10" rx="3" width="6" x="9" y="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v3" /></SvgIcon>;
}

function FilterIcon(): ReactElement {
  return (
    <SvgIcon className="h-[17px] w-[17px]" strokeWidth={1.7}>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
      <circle cx="8" cy="6.5" r="1.8" />
      <circle cx="15.8" cy="12" r="1.8" />
      <circle cx="10.5" cy="17.5" r="1.8" />
    </SvgIcon>
  );
}

function StackIcon(): ReactElement {
  return <SvgIcon className="h-[12px] w-[12px]" strokeWidth={1.7}><path d="m12 4 7 4-7 4-7-4 7-4Z" /><path d="m5 12 7 4 7-4" /><path d="m5 16 7 4 7-4" /></SvgIcon>;
}

function TrendIcon(): ReactElement {
  return <SvgIcon className="h-[17px] w-[17px]" strokeWidth={1.9}><path d="M5 16.5 10 11l3 3 6-7" /><path d="M14 7h5v5" /></SvgIcon>;
}

function PersonDebtIcon(props: { className?: string } = {}): ReactElement {
  return <SvgIcon className={props.className ?? 'h-[17px] w-[17px]'} strokeWidth={1.9}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5" /></SvgIcon>;
}

function ChevronRightIcon(): ReactElement {
  return <SvgIcon className="h-[14px] w-[14px]" strokeWidth={2.2}><path d="m9 6 6 6-6 6" /></SvgIcon>;
}

function GlyphIcon(props: { kind: string }): ReactElement {
  if (props.kind === 'whatsapp') return <WhatsappIcon option />;
  if (props.kind === 'bot') return <BotIcon className="h-[18px] w-[18px]" />;
  if (props.kind === 'money') return <MoneyIcon size="18px" />;
  if (props.kind === 'box') return <BoxIcon size="18px" />;
  if (props.kind === 'bill') return <TaskIcon size="18px" />;
  if (props.kind === 'bell') return <BellIcon size="18px" strokeWidth={1.8} />;
  if (props.kind === 'edit') return <EditIcon className="h-[18px] w-[18px]" />;
  if (props.kind === 'store') return <StoreIcon size="18px" strokeWidth={1.7} />;
  if (props.kind === 'pin') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={2}><path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></SvgIcon>;
  if (props.kind === 'user') return <PersonDebtIcon className="h-[18px] w-[18px]" />;
  if (props.kind === 'users') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M3 20c.6-3.5 2.3-5.2 5-5.2s4.4 1.7 5 5.2" /><path d="M16 11a2.5 2.5 0 1 0 0-5" /><path d="M14.5 15c2 .2 3.3 1.8 3.8 5" /></SvgIcon>;
  if (props.kind === 'gear') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.85}><path d="M9.6 3.2 9 5.6a7.5 7.5 0 0 0-1.6.9L5 5.8 3.2 8.9l1.8 1.7a7.9 7.9 0 0 0 0 1.8l-1.8 1.7L5 17.2l2.4-.7a7.5 7.5 0 0 0 1.6.9l.6 2.4h4.8l.6-2.4a7.5 7.5 0 0 0 1.6-.9l2.4.7 1.8-3.1-1.8-1.7a7.9 7.9 0 0 0 0-1.8l1.8-1.7L19 5.8l-2.4.7a7.5 7.5 0 0 0-1.6-.9l-.6-2.4H9.6Z" /><circle cx="12" cy="12" r="3" /></SvgIcon>;
  if (props.kind === 'cart') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="10" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></SvgIcon>;
  if (props.kind === 'cash') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><rect height="9" rx="2" width="16" x="4" y="8" /><path d="M7 8V5h10v3" /><path d="M8 13h3" /></SvgIcon>;
  if (props.kind === 'megaphone') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><path d="M4 13V9l11-4v12L4 13Z" /><path d="M8 14v4" /><path d="M18 9.5v3" /></SvgIcon>;
  if (props.kind === 'puzzle') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><path d="M8 3h8v5h3v8h-5v3H6v-8h2V8H5V5h3V3Z" /></SvgIcon>;
  if (props.kind === 'help') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.2 2.2c-1 .7-1.4 1.2-1.4 2.3" /><path d="M12 17h.01" /></SvgIcon>;
  if (props.kind === 'logout') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><path d="M10 5H5v14h5" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" /></SvgIcon>;
  if (props.kind === 'globe') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.2 2.5 3.2 5.5 3.2 9S14.2 18.5 12 21" /><path d="M12 3c-2.2 2.5-3.2 5.5-3.2 9s1 6.5 3.2 9" /></SvgIcon>;
  if (props.kind === 'report') return <SvgIcon className="h-[18px] w-[18px]" strokeWidth={1.9}><rect height="15" rx="2" width="14" x="5" y="4" /><path d="M9 15V9" /><path d="M12 15v-4" /><path d="M15 15V7" /></SvgIcon>;
  if (props.kind === 'alert') return <span className="text-[18px] font-extrabold leading-none">!</span>;
  return <MessageIcon size="18px" />;
}

function BranchCenterIcon(): ReactElement {
  return (
    <SvgIcon className="h-[16px] w-[16px]" strokeWidth={1.7}>
      <path d="m4.5 10.5 7.5-6 7.5 6" />
      <path d="M6.2 9.5v10h11.6v-10" />
      <path d="M9.5 19.5v-5h5v5" />
      <path d="M9.5 11.5h1" />
      <path d="M13.5 11.5h1" />
    </SvgIcon>
  );
}

function CheckIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="h-[10px] w-[10px]" fill="none" viewBox="0 0 12 12">
      <path d="m2.5 6.2 2.1 2.1 4.9-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function WhatsappIcon(props: { badge?: boolean; option?: boolean } = {}): ReactElement {
  const sizeClass = props.badge ? 'h-[19px] w-[19px]' : props.option ? 'h-[18px] w-[18px]' : 'h-[13px] w-[13px]';

  return (
    <span className={`flex ${sizeClass} items-center justify-center rounded-full bg-[#04bd63] text-white`}>
      <svg aria-hidden="true" fill="none" height="90%" viewBox="0 0 24 24" width="90%" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M7.2 19.2 8 16.7a7.2 7.2 0 1 1 2.8 1.1l-3.6 1.4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M9.2 8.6c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.6 1.3c.1.3.1.5-.1.7l-.3.4c-.1.1-.1.3 0 .5.4.8 1.2 1.6 2.1 2 .2.1.3.1.5-.1l.5-.6c.2-.2.4-.2.7-.1l1.3.6c.3.1.4.3.4.6v.4c0 .4-.2.7-.5.9-.7.4-1.8.4-3.4-.3-1.9-.8-3.8-2.6-4.6-4.5-.6-1.1-.4-1.8-.1-2.3l.3-.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function InstagramIcon(props: { badge?: boolean } = {}): ReactElement {
  const sizeClass = props.badge ? 'h-[19px] w-[19px] rounded-full' : 'h-[13px] w-[13px] rounded-[4px]';

  return (
    <span className={`flex ${sizeClass} items-center justify-center bg-gradient-to-br from-[#833ab4] via-[#e1306c] to-[#f77737] text-white`}>
      <svg aria-hidden="true" fill="none" height="90%" viewBox="0 0 24 24" width="90%" xmlns="http://www.w3.org/2000/svg">
        <rect height="14" rx="4" stroke="currentColor" strokeWidth="2.2" width="14" x="5" y="5" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="16.6" cy="7.5" fill="currentColor" r="1.2" />
      </svg>
    </span>
  );
}

function FacebookIcon(props: { badge?: boolean } = {}): ReactElement {
  const sizeClass = props.badge ? 'h-[19px] w-[19px]' : 'h-[13px] w-[13px]';

  return (
    <span className={`flex ${sizeClass} items-center justify-center rounded-full bg-[#1877f2] text-white`}>
      <svg aria-hidden="true" fill="currentColor" height="90%" viewBox="0 0 24 24" width="90%" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.2 8.1h2V5.2c-.3 0-1.5-.1-2.8-.1-2.8 0-4.6 1.7-4.6 4.8v2.7H5.7V16h3.1v7h3.8v-7h3.1l.5-3.4h-3.6v-2.3c0-1 .3-2.2 1.6-2.2Z" />
      </svg>
    </span>
  );
}

function EmailIcon(props: { badge?: boolean } = {}): ReactElement {
  const sizeClass = props.badge ? 'h-[19px] w-[19px] rounded-full' : 'h-[13px] w-[13px] rounded-[3px]';

  return (
    <span className={`flex ${sizeClass} items-center justify-center bg-[#6b4fc3] text-white`}>
      <svg aria-hidden="true" fill="none" height="90%" viewBox="0 0 24 24" width="90%" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6h16v12H4z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2.2" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      </svg>
    </span>
  );
}

function ChannelBadgeIcon(props: { channel: InboxChannel }): ReactElement {
  if (props.channel === 'whatsapp') return <WhatsappIcon badge />;
  if (props.channel === 'instagram') return <InstagramIcon badge />;
  if (props.channel === 'facebook') return <FacebookIcon badge />;
  return <EmailIcon badge />;
}

function DefaultPersonIcon(): ReactElement {
  return <SvgIcon className="h-[24px] w-[24px]" strokeWidth={0} ><circle cx="12" cy="8" r="4" fill="currentColor" /><path d="M4 21c1.1-5 4.1-7.5 8-7.5s6.9 2.5 8 7.5" fill="currentColor" /></SvgIcon>;
}

function EmailAvatarIcon(): ReactElement {
  return <SvgIcon className="h-[24px] w-[24px]" strokeWidth={1.8}><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></SvgIcon>;
}

function SparkleIcon(): ReactElement {
  return <SvgIcon className="h-[19px] w-[19px]" strokeWidth={2}><path d="M12 3 10.4 8.4 5 10l5.4 1.6L12 17l1.6-5.4L19 10l-5.4-1.6L12 3Z" /><path d="M5 3v4" /><path d="M3 5h4" /></SvgIcon>;
}

function ChatIcon(): ReactElement {
  return <SvgIcon className="h-[19px] w-[19px]"><path d="M5 6h14v10H8l-3 3V6Z" /><path d="M8 10h8" /></SvgIcon>;
}

function MessageIcon(props: { size?: string } = {}): ReactElement {
  return <SvgIcon className={props.size ? undefined : 'h-[17px] w-[17px]'} size={props.size}><path d="M5 6h14v11H8l-3 3V6Z" /><path d="M9 10h6" /><path d="M9 14h4" /></SvgIcon>;
}

function TaskIcon(props: { size?: string } = {}): ReactElement {
  return <SvgIcon className={props.size ? undefined : 'h-[17px] w-[17px]'} size={props.size}><path d="M7 4h10v16H7z" /><path d="m9 9 1 1 2-2" /><path d="M14 9h1" /><path d="M9 14h6" /></SvgIcon>;
}

function BoxIcon(props: { size?: string } = {}): ReactElement {
  return <SvgIcon className={props.size ? undefined : 'h-[18px] w-[18px]'} size={props.size}><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></SvgIcon>;
}

function MoneyIcon(props: { size?: string } = {}): ReactElement {
  return <SvgIcon className={props.size ? undefined : 'h-[18px] w-[18px]'} size={props.size}><circle cx="12" cy="12" r="9" /><path d="M12 7v10" /><path d="M15 9.5c-.7-.8-4-1.2-4 1 0 2.6 4 1.2 4 3.8 0 2.2-3.4 1.8-4.5.7" /></SvgIcon>;
}

function HomeIcon(props: { active?: boolean } = {}): ReactElement {
  return (
    <svg aria-hidden="true" className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path
        d="M6.1 10.3v8.6c0 .8.6 1.4 1.4 1.4h9c.8 0 1.4-.6 1.4-1.4v-8.6L12 5.2l-5.9 5.1Z"
        fill={props.active ? 'currentColor' : 'none'}
      />
      <path d="m4.5 10.7 7.5-6.4 7.5 6.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M6.1 10.3v8.6c0 .8.6 1.4 1.4 1.4h9c.8 0 1.4-.6 1.4-1.4v-8.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M9.6 20.3v-5.2h4.8v5.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function InboxIcon(props: { active?: boolean } = {}): ReactElement {
  return (
    <svg aria-hidden="true" className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 5.8h14c.9 0 1.6.7 1.6 1.6v8.7c0 .9-.7 1.6-1.6 1.6h-8.3L7.2 20v-2.3H5c-.9 0-1.6-.7-1.6-1.6V7.4c0-.9.7-1.6 1.6-1.6Z"
        fill={props.active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M7.8 10h8.4" stroke={props.active ? 'white' : 'currentColor'} strokeLinecap="round" strokeWidth="1.8" />
      <path d="M7.8 13.2h5.7" stroke={props.active ? 'white' : 'currentColor'} strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function BotIcon(props: { active?: boolean; className?: string } = {}): ReactElement {
  return (
    <svg aria-hidden="true" className={props.className ?? 'h-[22px] w-[22px]'} fill="none" viewBox="0 0 24 24">
      <path d="M12 4.2v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <circle cx="12" cy="3.4" fill={props.active ? 'currentColor' : 'none'} r="1.1" stroke="currentColor" strokeWidth="1.6" />
      <rect height="11.1" rx="3.7" stroke="currentColor" strokeWidth="1.9" width="14.5" x="4.75" y="7.9" />
      <circle cx="9.2" cy="13.1" fill="currentColor" r="1.15" />
      <circle cx="14.8" cy="13.1" fill="currentColor" r="1.15" />
      <path d="M9.6 16.1c1.4.8 3.4.8 4.8 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}

function MenuIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path d="M5 7h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
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

import { useMemo, useState, type ReactElement } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { useAiDrafts } from '../hooks/useAiDrafts';
import { type InboxState, useInbox } from '../hooks/useInbox';
import { type OwnerCopilotState, useOwnerCopilot } from '../hooks/useOwnerCopilot';
import { useOwnerSettings } from '../hooks/useOwnerSettings';
import { type OwnerTasksState, useOwnerTasks } from '../hooks/useOwnerTasks';
import { useProducts } from '../hooks/useProducts';
import { mobileUi } from '../mobileUiStyles';
import type { OwnerDashboard } from '../types/dashboard';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';
import type { OwnerNotification } from '../types/tasks';

type DashboardTab = 'home' | 'inbox' | 'copi' | 'more';

interface DashboardScreenProps {
  dashboard: OwnerDashboard;
  onSignOut: () => void;
}

export function DashboardScreen(props: DashboardScreenProps): ReactElement {
  const organizationId = props.dashboard.organization?.id ?? null;
  const businessCenterId = props.dashboard.businessCenter?.id ?? null;
  const inbox = useInbox(organizationId, businessCenterId);
  const ownerTasks = useOwnerTasks(organizationId, businessCenterId);
  const products = useProducts(organizationId, businessCenterId);
  const aiDrafts = useAiDrafts(organizationId, businessCenterId);
  const copilot = useOwnerCopilot(organizationId);
  const settings = useOwnerSettings(props.dashboard);
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [showBranches, setShowBranches] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const lowStockCount = useMemo(
    () => products.products.filter((product) => product.isLowStock).length,
    [products.products],
  );

  function openTab(tab: DashboardTab): void {
    setActiveTab(tab);
    setShowAccount(false);
  }

  return (
    <View style={mobileUi.shell}>
      <AppHeader
        activeCenterName={props.dashboard.businessCenter?.name ?? 'Sucursal Centro'}
        onOpenAccount={() => setShowAccount(true)}
        onOpenNotifications={() => setActiveTab('more')}
        onToggleBranches={() => setShowBranches((current) => !current)}
        showBranches={showBranches}
      />
      {showAccount ? (
        <AccountScreen
          dashboard={props.dashboard}
          onSignOut={props.onSignOut}
          settings={settings.formValues}
        />
      ) : activeTab === 'home' ? (
        <HomeScreen
          dashboard={props.dashboard}
          inbox={inbox}
          lowStockCount={lowStockCount}
          notifications={ownerTasks.notifications}
          pendingDrafts={aiDrafts.drafts.length}
          pendingTasks={ownerTasks.tasks.length}
          productsCount={products.products.length}
          setActiveTab={openTab}
        />
      ) : activeTab === 'inbox' ? (
        <InboxScreen inbox={inbox} />
      ) : activeTab === 'copi' ? (
        <CopiScreen copilot={copilot} dashboard={props.dashboard} ownerTasks={ownerTasks} />
      ) : (
        <MoreScreen
          dashboard={props.dashboard}
          onOpenAccount={() => setShowAccount(true)}
          onSignOut={props.onSignOut}
          ownerTasks={ownerTasks}
          productsCount={products.products.length}
        />
      )}
      <BottomNavigation activeTab={activeTab} onSelectTab={openTab} />
    </View>
  );
}

function AppHeader(props: {
  activeCenterName: string;
  onOpenAccount: () => void;
  onOpenNotifications: () => void;
  onToggleBranches: () => void;
  showBranches: boolean;
}): ReactElement {
  return (
    <View style={mobileUi.header}>
      <View>
        <Text style={mobileUi.logo}>nexolia</Text>
        <Text style={mobileUi.logoTagline}>Tu negocio, mas inteligente</Text>
      </View>
      <View style={mobileUi.headerActions}>
        <Pressable onPress={props.onOpenNotifications} style={mobileUi.headerIcon}>
          <Text style={mobileUi.headerIconText}>!</Text>
          <View style={mobileUi.unreadDot} />
        </Pressable>
        <Pressable onPress={props.onToggleBranches} style={mobileUi.centerSwitcher}>
          <Text style={mobileUi.headerIconText}>⌂</Text>
          <Text style={mobileUi.chevron}>{props.showBranches ? '⌃' : '⌄'}</Text>
        </Pressable>
        <Pressable onPress={props.onOpenAccount} style={mobileUi.avatar}>
          <Text style={mobileUi.avatarText}>JF</Text>
        </Pressable>
      </View>
      {props.showBranches ? (
        <View style={mobileUi.branchMenu}>
          {['Sucursal Centro', 'Sucursal Palermo', 'Deposito / Taller'].map((branch) => (
            <View
              key={branch}
              style={[
                mobileUi.branchRow,
                branch === props.activeCenterName && mobileUi.activeBranchRow,
              ]}
            >
              <Text
                style={[
                  mobileUi.branchText,
                  branch === props.activeCenterName && mobileUi.activeBranchText,
                ]}
              >
                {branch}
              </Text>
              {branch === props.activeCenterName ? <Text style={mobileUi.activeBranchText}>✓</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function HomeScreen(props: {
  dashboard: OwnerDashboard;
  inbox: InboxState;
  lowStockCount: number;
  notifications: OwnerNotification[];
  pendingDrafts: number;
  pendingTasks: number;
  productsCount: number;
  setActiveTab: (tab: DashboardTab) => void;
}): ReactElement {
  const conversations = props.inbox.conversations.slice(0, 4);
  const notifications = props.notifications.slice(0, 3);

  return (
    <View style={mobileUi.content}>
      <Text style={mobileUi.greeting}>Hola Juli!</Text>
      <Text style={mobileUi.subheading}>En que puedo ayudarte hoy?</Text>
      <Pressable onPress={() => props.setActiveTab('copi')} style={mobileUi.copiCard}>
        <Robot />
        <View style={mobileUi.flex}>
          <Text style={mobileUi.cardTitle}>Copi - Tu asistente IA</Text>
          <Text style={mobileUi.cardDescription}>
            Preguntame sobre tus ventas, stock, clientes y mas.
          </Text>
        </View>
        <View style={mobileUi.chatButton}>
          <Text style={mobileUi.chatButtonText}>💬</Text>
        </View>
      </Pressable>
      <View style={mobileUi.card}>
        <Text style={mobileUi.sectionTitle}>Resumen del dia</Text>
        <Text style={mobileUi.cardDescription}>Asi va tu negocio hasta ahora. Sigue asi!</Text>
        <View style={mobileUi.metricGrid}>
          <Metric label="Mensajes hoy" tone="green" value={props.dashboard.metrics.openConversations} />
          <Metric label="Seguimientos" tone="orange" value={props.pendingTasks} />
          <Metric label="Bajo stock" tone="red" value={props.lowStockCount} />
          <Metric label="Ventas" tone="green" value="$1.250.000" />
        </View>
      </View>
      <SectionHeader
        actionLabel="Ver todas"
        onAction={() => props.setActiveTab('inbox')}
        title="Conversaciones recientes"
      />
      <View style={mobileUi.card}>
        {(conversations.length > 0 ? conversations : fallbackConversations).map((conversation) => (
          <ConversationRow
            conversation={conversation}
            key={typeof conversation === 'string' ? conversation : conversation.id}
          />
        ))}
      </View>
      <Pressable
        onPress={() => Alert.alert('Inventario', `${props.productsCount} productos cargados.`)}
        style={mobileUi.inventoryCard}
      >
        <View style={mobileUi.iconTile}>
          <Text style={mobileUi.iconTileText}>□</Text>
        </View>
        <View style={mobileUi.flex}>
          <Text style={mobileUi.cardTitle}>Gestionar stock</Text>
          <Text style={mobileUi.cardDescription}>Revisa tu inventario y actualiza productos</Text>
        </View>
        <Text style={mobileUi.primaryText}>Ver inventario ›</Text>
      </Pressable>
      <SectionHeader actionLabel="Ver todas" onAction={() => props.setActiveTab('more')} title="Alertas recientes" />
      <View style={mobileUi.card}>
        {(notifications.length > 0 ? notifications : fallbackNotifications).map((notification) => (
          <NotificationRow key={notification.id} notification={notification} />
        ))}
      </View>
      {props.pendingDrafts > 0 ? (
        <Text style={mobileUi.noteText}>{props.pendingDrafts} borradores de IA pendientes de revision.</Text>
      ) : null}
    </View>
  );
}

function InboxScreen(props: { inbox: InboxState }): ReactElement {
  if (props.inbox.selectedConversation) {
    return (
      <ThreadScreen
        conversation={props.inbox.selectedConversation}
        messages={props.inbox.messages}
        onBack={() => props.inbox.selectConversation('')}
      />
    );
  }

  const conversations =
    props.inbox.conversations.length > 0 ? props.inbox.conversations : fallbackConversations;

  return (
    <View style={mobileUi.content}>
      <Text style={mobileUi.screenTitle}>Inbox</Text>
      <Text style={mobileUi.subheading}>Todas tus conversaciones en un solo lugar</Text>
      <View style={mobileUi.searchRow}>
        <Text style={mobileUi.searchInput}>Buscar conversaciones</Text>
        <Text style={mobileUi.filterButton}>≡</Text>
      </View>
      <View style={mobileUi.channelRow}>
        {['Todos', 'WhatsApp', 'Instagram', 'Facebook', 'Email'].map((channel, index) => (
          <View key={channel} style={[mobileUi.channelPill, index === 0 && mobileUi.activeChannelPill]}>
            <Text style={[mobileUi.channelText, index === 0 && mobileUi.activeChannelText]}>{channel}</Text>
          </View>
        ))}
      </View>
      <View style={mobileUi.card}>
        <View style={mobileUi.statusTabs}>
          <Text style={mobileUi.activeStatusTab}>Abiertos 12</Text>
          <Text style={mobileUi.statusTab}>Pendientes 5</Text>
          <Text style={mobileUi.statusTab}>Resueltos 28</Text>
        </View>
        {conversations.map((conversation) => (
          <Pressable
            key={conversation.id}
            onPress={() => props.inbox.selectConversation(conversation.id)}
          >
            <ConversationRow conversation={conversation} showUnread />
          </Pressable>
        ))}
      </View>
      {props.inbox.errorMessage ? <Text style={mobileUi.errorText}>{props.inbox.errorMessage}</Text> : null}
    </View>
  );
}

function ThreadScreen(props: {
  conversation: InboxConversationSummary;
  messages: WhatsAppMessagePreview[];
  onBack: () => void;
}): ReactElement {
  const messages = props.messages.length > 0 ? props.messages : fallbackMessages(props.conversation.id);

  return (
    <View style={mobileUi.content}>
      <View style={mobileUi.threadHeader}>
        <Pressable onPress={props.onBack}>
          <Text style={mobileUi.backText}>‹</Text>
        </Pressable>
        <Avatar label={getConversationName(props.conversation).slice(0, 2)} />
        <View style={mobileUi.flex}>
          <Text style={mobileUi.screenTitle}>{getConversationName(props.conversation)}</Text>
          <Text style={mobileUi.cardDescription}>Nuevo lead · WhatsApp</Text>
        </View>
      </View>
      <View style={mobileUi.threadCard}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </View>
      <ReplyInput placeholder="Escribi un mensaje..." />
    </View>
  );
}

function CopiScreen(props: {
  copilot: OwnerCopilotState;
  dashboard: OwnerDashboard;
  ownerTasks: OwnerTasksState;
}): ReactElement {
  const hasConversation = props.copilot.messages.length > 1;

  return (
    <View style={mobileUi.content}>
      <Text style={mobileUi.screenTitle}>Copi</Text>
      <Text style={mobileUi.subheading}>Tu asistente IA para el negocio</Text>
      {hasConversation ? (
        <View style={mobileUi.card}>
          <View style={mobileUi.copiHeader}>
            <Robot />
            <View>
              <Text style={mobileUi.cardTitle}>Copi</Text>
              <Text style={mobileUi.cardDescription}>Asistente IA</Text>
            </View>
          </View>
          {props.copilot.messages.map((message) => (
            <View
              key={message.id}
              style={[
                mobileUi.copilotBubble,
                message.role === 'owner' && mobileUi.ownerCopilotBubble,
              ]}
            >
              <Text style={mobileUi.messageText}>{message.body}</Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          <View style={mobileUi.copiWelcome}>
            <Robot />
            <View style={mobileUi.flex}>
              <Text style={mobileUi.cardTitle}>Hola! Soy Copi</Text>
              <Text style={mobileUi.cardDescription}>
                Preguntame por ventas, stock, clientes y tareas pendientes.
              </Text>
            </View>
          </View>
          <Text style={mobileUi.sectionTitle}>Preguntas sugeridas</Text>
          <View style={mobileUi.card}>
            {[
              'Que necesita mi atencion hoy?',
              'Cuanto vendi este mes?',
              'Quien me debe dinero?',
              'Que productos tienen bajo stock?',
              'Que producto tiene mayor margen?',
            ].map((question) => (
              <ActionRow
                key={question}
                label={question}
                onPress={() => {
                  void props.copilot.askQuestion(question);
                }}
              />
            ))}
          </View>
          <View style={mobileUi.card}>
            <Text style={mobileUi.messageText}>
              Hoy tenes {props.dashboard.metrics.openConversations} conversaciones abiertas,{' '}
              {props.dashboard.metrics.lowStockItems} productos con bajo stock y{' '}
              {props.ownerTasks.tasks.length} seguimientos pendientes.
            </Text>
          </View>
        </>
      )}
      <ReplyInput
        onChangeText={props.copilot.setInputValue}
        onSubmit={() => {
          void props.copilot.askQuestion();
        }}
        placeholder="Escribi tu pregunta..."
        value={props.copilot.inputValue}
      />
      {props.copilot.errorMessage ? <Text style={mobileUi.errorText}>{props.copilot.errorMessage}</Text> : null}
    </View>
  );
}

function MoreScreen(props: {
  dashboard: OwnerDashboard;
  onOpenAccount: () => void;
  onSignOut: () => void;
  ownerTasks: OwnerTasksState;
  productsCount: number;
}): ReactElement {
  return (
    <View style={mobileUi.content}>
      <Text style={mobileUi.screenTitle}>Mas</Text>
      <Text style={mobileUi.subheading}>Herramientas y accesos de tu negocio</Text>
      <View style={mobileUi.quickActionRow}>
        {['Reportes', 'Finanzas', 'Configuracion'].map((label) => (
          <View key={label} style={mobileUi.quickAction}>
            <Text style={mobileUi.quickActionText}>{label}</Text>
          </View>
        ))}
      </View>
      <MenuSection
        rows={[
          ['Inventario', `${props.productsCount} productos y movimientos`],
          ['Facturacion', 'Comprobantes y cobros'],
          ['Compras y proveedores', 'Ordenes y abastecimiento'],
          ['Caja', 'Ingresos, egresos y cierre'],
        ]}
        title="Operacion"
      />
      <MenuSection
        rows={[
          ['Marketing', 'Promociones, campanas y posteos'],
          ['Portal del cliente', 'Catalogo, reservas y seguimiento'],
          ['Automatizaciones', 'Mensajes, reglas y acciones'],
        ]}
        title="Crecimiento"
      />
      <MenuSection
        rows={[
          ['Mi cuenta', 'Perfil, rol y sucursal', props.onOpenAccount],
          ['Integraciones', 'WhatsApp, Instagram y Email'],
          ['Ayuda y soporte', 'Guias y asistencia'],
        ]}
        title="Configuracion"
      />
      <View style={mobileUi.card}>
        {(props.ownerTasks.notifications.length > 0 ? props.ownerTasks.notifications : fallbackNotifications).map(
          (notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ),
        )}
      </View>
      <Pressable onPress={props.onSignOut} style={mobileUi.signOutRow}>
        <Text style={mobileUi.signOutText}>Cerrar sesion</Text>
      </Pressable>
      <Text style={mobileUi.noteText}>
        {props.dashboard.whatsappConnection.status === 'connected'
          ? `WhatsApp conectado ${props.dashboard.whatsappConnection.displayPhoneNumber ?? ''}`
          : 'WhatsApp pendiente de conexion'}
      </Text>
    </View>
  );
}

function AccountScreen(props: {
  dashboard: OwnerDashboard;
  onSignOut: () => void;
  settings: {
    aiAutoSend: boolean;
    businessHoursEnabled: boolean;
    followUpDelayHours: string;
  };
}): ReactElement {
  return (
    <View style={mobileUi.content}>
      <Text style={mobileUi.screenTitle}>Mi cuenta</Text>
      <Text style={mobileUi.subheading}>Gestiona tu perfil y tu negocio</Text>
      <View style={mobileUi.profileCard}>
        <View style={mobileUi.profileAvatar}>
          <Text style={mobileUi.profileAvatarText}>JF</Text>
        </View>
        <View style={mobileUi.flex}>
          <Text style={mobileUi.profileName}>Juli Fernandez</Text>
          <Text style={mobileUi.profileLine}>{props.dashboard.organization?.name ?? 'Almacen Juli'} · Negocio</Text>
          <Text style={mobileUi.profileLine}>{props.dashboard.businessCenter?.name ?? 'Sucursal Centro'} · Sucursal</Text>
          <Text style={mobileUi.profileLine}>{props.dashboard.organization?.role ?? 'owner'} · Rol</Text>
        </View>
      </View>
      <View style={mobileUi.card}>
        {['Editar perfil', 'Cambiar sucursal', 'Usuarios y permisos', 'Configuracion del negocio', 'Notificaciones', 'Ayuda y soporte'].map(
          (label) => (
            <ActionRow key={label} label={label} />
          ),
        )}
      </View>
      <View style={mobileUi.card}>
        <Text style={mobileUi.messageText}>
          AI auto-send: {props.settings.aiAutoSend ? 'Activo' : 'Inactivo'} · Seguimiento:{' '}
          {props.settings.followUpDelayHours}h · Horario:{' '}
          {props.settings.businessHoursEnabled ? 'Activo' : 'Inactivo'}
        </Text>
      </View>
      <Pressable onPress={props.onSignOut} style={mobileUi.signOutRow}>
        <Text style={mobileUi.signOutText}>Cerrar sesion</Text>
      </Pressable>
      <Text style={mobileUi.noteText}>Zona horaria: {props.dashboard.businessCenter?.timezone ?? 'Argentina / Cordoba'}</Text>
    </View>
  );
}

function Metric(props: { label: string; tone: 'green' | 'orange' | 'red'; value: number | string }): ReactElement {
  const valueStyle =
    props.tone === 'green'
      ? mobileUi.metricGreen
      : props.tone === 'orange'
        ? mobileUi.metricOrange
        : mobileUi.metricRed;

  return (
    <View style={mobileUi.metricItem}>
      <Text style={[mobileUi.metricValue, valueStyle]}>{props.value}</Text>
      <Text style={mobileUi.metricLabel}>{props.label}</Text>
    </View>
  );
}

function SectionHeader(props: {
  actionLabel?: string;
  onAction?: () => void;
  title: string;
}): ReactElement {
  return (
    <View style={mobileUi.sectionHeader}>
      <Text style={mobileUi.sectionTitle}>{props.title}</Text>
      {props.actionLabel && props.onAction ? (
        <Pressable onPress={props.onAction}>
          <Text style={mobileUi.sectionAction}>{props.actionLabel} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ConversationRow(props: {
  conversation: InboxConversationSummary;
  showUnread?: boolean;
}): ReactElement {
  const name = getConversationName(props.conversation);
  const preview = props.conversation.latestMessage?.body ?? 'Hola, tienen disponible el producto...?';

  return (
    <View style={mobileUi.listRow}>
      <Avatar label={name.slice(0, 2)} />
      <View style={mobileUi.flex}>
        <Text style={mobileUi.listTitle}>{name}</Text>
        <Text numberOfLines={1} style={mobileUi.listDescription}>
          {preview}
        </Text>
        <Text style={mobileUi.leadBadge}>{leadStatusLabel(props.conversation.contact.leadStatus)}</Text>
      </View>
      <View style={mobileUi.rowMeta}>
        <Text style={mobileUi.timestamp}>{formatTime(props.conversation.lastMessageAt)}</Text>
        {props.showUnread ? <Text style={mobileUi.unreadBadge}>2</Text> : null}
      </View>
    </View>
  );
}

function NotificationRow(props: { notification: OwnerNotification }): ReactElement {
  return (
    <View style={mobileUi.listRow}>
      <View style={mobileUi.alertIcon}>
        <Text style={mobileUi.alertIconText}>!</Text>
      </View>
      <View style={mobileUi.flex}>
        <Text style={mobileUi.listTitle}>{props.notification.title}</Text>
        <Text style={mobileUi.listDescription}>{props.notification.body}</Text>
      </View>
      <Text style={mobileUi.timestamp}>Hoy</Text>
    </View>
  );
}

function MessageBubble(props: { message: WhatsAppMessagePreview }): ReactElement {
  const outbound = props.message.direction === 'outbound';

  return (
    <View style={[mobileUi.messageBubble, outbound && mobileUi.outboundMessageBubble]}>
      <Text style={mobileUi.messageText}>{props.message.body ?? 'Mensaje sin texto'}</Text>
      <Text style={mobileUi.messageTime}>{formatTime(props.message.createdAt)}</Text>
    </View>
  );
}

function ReplyInput(props: {
  onChangeText?: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  value?: string;
}): ReactElement {
  return (
    <View style={mobileUi.replyBar}>
      <Text style={mobileUi.addButton}>+</Text>
      <TextInput
        onChangeText={props.onChangeText}
        onSubmitEditing={props.onSubmit}
        placeholder={props.placeholder}
        style={mobileUi.replyInput}
        value={props.value}
      />
      <Pressable onPress={props.onSubmit} style={mobileUi.micButton}>
        <Text style={mobileUi.micButtonText}>●</Text>
      </Pressable>
    </View>
  );
}

function ActionRow(props: { label: string; onPress?: () => void }): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={mobileUi.actionRow}>
      <View style={mobileUi.iconTileSmall}>
        <Text style={mobileUi.iconTileText}>·</Text>
      </View>
      <Text style={mobileUi.actionLabel}>{props.label}</Text>
      <Text style={mobileUi.primaryText}>›</Text>
    </Pressable>
  );
}

function MenuSection(props: {
  rows: Array<[string, string] | [string, string, () => void]>;
  title: string;
}): ReactElement {
  return (
    <View>
      <Text style={mobileUi.sectionTitle}>{props.title}</Text>
      <View style={mobileUi.card}>
        {props.rows.map(([title, subtitle, onPress]) => (
          <Pressable key={title} onPress={onPress} style={mobileUi.actionRow}>
            <View style={mobileUi.iconTileSmall}>
              <Text style={mobileUi.iconTileText}>□</Text>
            </View>
            <View style={mobileUi.flex}>
              <Text style={mobileUi.listTitle}>{title}</Text>
              <Text style={mobileUi.listDescription}>{subtitle}</Text>
            </View>
            <Text style={mobileUi.primaryText}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BottomNavigation(props: {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}): ReactElement {
  return (
    <View style={mobileUi.bottomNav}>
      <TabButton active={props.activeTab === 'home'} label="Inicio" onPress={() => props.onSelectTab('home')} />
      <TabButton active={props.activeTab === 'inbox'} label="Inbox" onPress={() => props.onSelectTab('inbox')} />
      <Pressable onPress={() => props.onSelectTab('home')} style={mobileUi.centerAction}>
        <Text style={mobileUi.centerActionText}>$</Text>
      </Pressable>
      <TabButton active={props.activeTab === 'copi'} label="Copi" onPress={() => props.onSelectTab('copi')} />
      <TabButton active={props.activeTab === 'more'} label="Mas" onPress={() => props.onSelectTab('more')} />
    </View>
  );
}

function TabButton(props: {
  active: boolean;
  label: string;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable onPress={props.onPress} style={mobileUi.tabButton}>
      <Text style={[mobileUi.tabIcon, props.active && mobileUi.activeTabText]}>□</Text>
      <Text style={[mobileUi.tabLabel, props.active && mobileUi.activeTabText]}>{props.label}</Text>
    </Pressable>
  );
}

function Robot(): ReactElement {
  return (
    <View style={mobileUi.robot}>
      <View style={mobileUi.robotFace}>
        <Text style={mobileUi.robotEyes}>••</Text>
      </View>
    </View>
  );
}

function Avatar(props: { label: string }): ReactElement {
  return (
    <View style={mobileUi.customerAvatar}>
      <Text style={mobileUi.customerAvatarText}>{props.label.toUpperCase()}</Text>
    </View>
  );
}

function getConversationName(conversation: InboxConversationSummary): string {
  return (
    conversation.contact.displayName ??
    conversation.contact.phoneNumber ??
    conversation.externalContactId ??
    'Cliente'
  );
}

function leadStatusLabel(status: InboxConversationSummary['contact']['leadStatus']): string {
  if (status === 'active') {
    return 'Seguimiento';
  }

  if (status === 'won') {
    return 'Cliente';
  }

  return 'Nuevo lead';
}

function formatTime(value: string | null): string {
  if (!value) {
    return 'Hoy';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Hoy';
  }

  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function fallbackMessages(conversationId: string): WhatsAppMessagePreview[] {
  return [
    {
      body: 'Hola, tienen disponible el producto Amanda 1kg?',
      conversationId,
      createdAt: new Date().toISOString(),
      direction: 'inbound',
      id: 'fallback-1',
      messageStatus: 'received',
      recipientPhone: null,
      senderPhone: '+5491123456789',
    },
    {
      body: 'Hola Maria! Si, tenemos stock disponible.',
      conversationId,
      createdAt: new Date().toISOString(),
      direction: 'outbound',
      id: 'fallback-2',
      messageStatus: 'sent',
      recipientPhone: '+5491123456789',
      senderPhone: null,
    },
  ];
}

const fallbackConversations: InboxConversationSummary[] = [
  {
    contact: {
      displayName: 'Maria Gonzalez',
      id: 'contact-1',
      leadStatus: 'new',
      phoneNumber: '+54 9 11 2345-6789',
    },
    externalContactId: '5491123456789',
    id: 'conversation-1',
    lastMessageAt: new Date().toISOString(),
    latestMessage: {
      body: 'Hola, tienen disponible el producto...?',
      conversationId: 'conversation-1',
      createdAt: new Date().toISOString(),
      direction: 'inbound',
      id: 'message-1',
      messageStatus: 'received',
      recipientPhone: null,
      senderPhone: '+54 9 11 2345-6789',
    },
    status: 'open',
  },
  {
    contact: {
      displayName: '@tiendabaas',
      id: 'contact-2',
      leadStatus: 'new',
      phoneNumber: null,
    },
    externalContactId: 'instagram:tiendabaas',
    id: 'conversation-2',
    lastMessageAt: new Date().toISOString(),
    latestMessage: {
      body: 'Hacen envios a domicilio?',
      conversationId: 'conversation-2',
      createdAt: new Date().toISOString(),
      direction: 'inbound',
      id: 'message-2',
      messageStatus: 'received',
      recipientPhone: null,
      senderPhone: null,
    },
    status: 'open',
  },
];

const fallbackNotifications: OwnerNotification[] = [
  {
    body: 'El producto Camiseta Basica esta con bajo stock (2 unidades).',
    createdAt: new Date().toISOString(),
    errorMessage: null,
    id: 'notification-1',
    productLabel: 'Camiseta Basica',
    pushSentAt: null,
    status: 'pending',
    title: 'Bajo stock',
  },
  {
    body: 'Tenes seguimientos pendientes por realizar.',
    createdAt: new Date().toISOString(),
    errorMessage: null,
    id: 'notification-2',
    productLabel: null,
    pushSentAt: null,
    status: 'pending',
    title: 'Seguimientos pendientes',
  },
];

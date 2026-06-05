import type { ReactElement } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { Metric } from '../components/Metric';
import { useAiDrafts } from '../hooks/useAiDrafts';
import { useInbox } from '../hooks/useInbox';
import { useOwnerTasks } from '../hooks/useOwnerTasks';
import { useProducts } from '../hooks/useProducts';
import { styles } from '../styles';
import type { AiDraft } from '../types/aiDrafts';
import type { OwnerDashboard } from '../types/dashboard';
import type { InboxConversationSummary, WhatsAppMessagePreview } from '../types/messages';
import type { Product } from '../types/products';
import type { OwnerNotification, OwnerTask } from '../types/tasks';

export function DashboardScreen(props: {
  dashboard: OwnerDashboard;
  onSignOut: () => void;
}): ReactElement {
  const inbox = useInbox(props.dashboard.organization?.id ?? null);
  const ownerTasks = useOwnerTasks(props.dashboard.organization?.id ?? null);
  const productCatalog = useProducts(props.dashboard.organization?.id ?? null);
  const aiDrafts = useAiDrafts(props.dashboard.organization?.id ?? null);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{props.dashboard.organization?.name ?? 'Owner dashboard'}</Text>
      <Text style={styles.bodyText}>Your Phase 0 dashboard is ready.</Text>
      <WhatsAppConnectionCard dashboard={props.dashboard} />
      <InboxCard inbox={inbox} />
      <View style={styles.metricsGrid}>
        <Metric label="Contacts" value={props.dashboard.metrics.contacts} />
        <Metric label="Open chats" value={props.dashboard.metrics.openConversations} />
        <Metric label="Products" value={props.dashboard.metrics.products} />
        <Metric label="Low stock" value={props.dashboard.metrics.lowStockItems} />
        <Metric label="Follow-ups" value={props.dashboard.metrics.pendingFollowUps} />
        <Metric label="AI drafts" value={props.dashboard.metrics.pendingAiDrafts} />
      </View>
      <AiDraftsCard aiDrafts={aiDrafts} />
      <FollowUpTasksCard ownerTasks={ownerTasks} />
      <ProductCatalogCard catalog={productCatalog} />
      {props.dashboard.emptyStates.map((emptyState: string) => (
        <Text key={emptyState} style={styles.emptyState}>
          {emptyState}
        </Text>
      ))}
      <SecondaryButton label="Sign out" onPress={props.onSignOut} />
    </View>
  );
}

function AiDraftsCard(props: { aiDrafts: ReturnType<typeof useAiDrafts> }): ReactElement {
  const { aiDrafts } = props;

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>Sales AI drafts</Text>
      {aiDrafts.isLoading ? <Text style={styles.statusDetail}>Loading AI drafts...</Text> : null}
      {aiDrafts.errorMessage ? <Text style={styles.statusError}>{aiDrafts.errorMessage}</Text> : null}
      {aiDrafts.drafts.length === 0 ? (
        <Text style={styles.statusDetail}>
          Catalog-aware reply and quote drafts will appear here after customer messages.
        </Text>
      ) : (
        <View style={styles.taskList}>
          {aiDrafts.drafts.map((draft) => (
            <AiDraftItem
              draft={draft}
              editedBody={aiDrafts.editedBodies[draft.id] ?? draft.replyBody}
              isSaving={aiDrafts.isSaving}
              key={draft.id}
              onApprove={() => {
                void aiDrafts.approveDraft(draft.id);
              }}
              onChangeBody={(body) => aiDrafts.setEditedBody(draft.id, body)}
              onReject={() => {
                void aiDrafts.rejectDraft(draft.id);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function AiDraftItem(props: {
  draft: AiDraft;
  editedBody: string;
  isSaving: boolean;
  onApprove: () => void;
  onChangeBody: (body: string) => void;
  onReject: () => void;
}): ReactElement {
  const { draft } = props;

  return (
    <View style={styles.taskItem}>
      <View style={styles.productHeader}>
        <Text style={styles.conversationTitle}>{draft.contactLabel}</Text>
        <Text style={styles.aiDraftBadge}>{draft.draftType}</Text>
      </View>
      <Text style={styles.conversationMeta}>
        {draft.status}
        {draft.autoSendEligible ? ' · auto-send eligible' : ' · review required'}
      </Text>
      {draft.decisionReason ? (
        <Text style={styles.statusDetail}>{formatAiDecisionReason(draft.decisionReason)}</Text>
      ) : null}
      {draft.errorMessage ? <Text style={styles.statusError}>{draft.errorMessage}</Text> : null}
      <TextInput
        multiline
        onChangeText={props.onChangeBody}
        style={[styles.input, styles.multilineInput]}
        value={props.editedBody}
      />
      <View style={styles.inlineActions}>
        <PrimaryButton
          disabled={props.isSaving}
          label={props.isSaving ? 'Sending...' : 'Approve & send'}
          onPress={props.onApprove}
        />
        <SecondaryButton label="Reject" onPress={props.onReject} />
      </View>
    </View>
  );
}

function FollowUpTasksCard(props: { ownerTasks: ReturnType<typeof useOwnerTasks> }): ReactElement {
  const { ownerTasks } = props;

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>Follow-ups and alerts</Text>
      {ownerTasks.isLoading ? <Text style={styles.statusDetail}>Loading tasks...</Text> : null}
      {ownerTasks.errorMessage ? <Text style={styles.statusError}>{ownerTasks.errorMessage}</Text> : null}
      <SecondaryButton
        label={ownerTasks.isSaving ? 'Working...' : 'Enable low-stock push alerts'}
        onPress={() => {
          void ownerTasks.enablePushNotifications();
        }}
      />
      {ownerTasks.pushRegistrationStatus ? (
        <Text style={styles.statusDetail}>{ownerTasks.pushRegistrationStatus}</Text>
      ) : null}
      {ownerTasks.tasks.length === 0 ? (
        <Text style={styles.statusDetail}>No pending follow-ups right now.</Text>
      ) : (
        <View style={styles.taskList}>
          {ownerTasks.tasks.map((task) => (
            <FollowUpTaskItem
              key={task.id}
              onComplete={() => {
                void ownerTasks.completeTask(task.id);
              }}
              onSnooze={() => {
                void ownerTasks.snoozeTask(task.id);
              }}
              task={task}
            />
          ))}
        </View>
      )}
      {ownerTasks.notifications.length > 0 ? (
        <View style={styles.taskList}>
          <Text style={styles.statusValue}>Recent alerts</Text>
          {ownerTasks.notifications.map((notification) => (
            <OwnerNotificationItem
              key={notification.id}
              notification={notification}
              onDismiss={() => {
                void ownerTasks.dismissNotification(notification.id);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FollowUpTaskItem(props: {
  onComplete: () => void;
  onSnooze: () => void;
  task: OwnerTask;
}): ReactElement {
  const { task } = props;

  return (
    <View style={styles.taskItem}>
      <Text style={styles.conversationTitle}>{task.title}</Text>
      <Text style={styles.conversationMeta}>
        {task.contactLabel ?? 'Unknown contact'}
        {task.dueAt ? ` · due ${formatDateTime(task.dueAt)}` : ''}
      </Text>
      {task.description ? (
        <Text style={styles.messagePreviewBody}>{task.description}</Text>
      ) : null}
      {task.status === 'snoozed' && task.snoozedUntil ? (
        <Text style={styles.statusDetail}>Snoozed until {formatDateTime(task.snoozedUntil)}</Text>
      ) : null}
      <View style={styles.inlineActions}>
        <SecondaryButton label="Complete" onPress={props.onComplete} />
        <SecondaryButton label="Snooze 24h" onPress={props.onSnooze} />
      </View>
    </View>
  );
}

function OwnerNotificationItem(props: {
  notification: OwnerNotification;
  onDismiss: () => void;
}): ReactElement {
  const { notification } = props;

  return (
    <View style={styles.taskItem}>
      <View style={styles.productHeader}>
        <Text style={styles.conversationTitle}>{notification.title}</Text>
        <Text style={styles.lowStockBadge}>{notification.status}</Text>
      </View>
      <Text style={styles.messagePreviewBody}>{notification.body}</Text>
      {notification.productLabel ? (
        <Text style={styles.conversationMeta}>{notification.productLabel}</Text>
      ) : null}
      {notification.errorMessage ? (
        <Text style={styles.statusError}>{notification.errorMessage}</Text>
      ) : null}
      <SecondaryButton label="Dismiss" onPress={props.onDismiss} />
    </View>
  );
}

function ProductCatalogCard(props: { catalog: ReturnType<typeof useProducts> }): ReactElement {
  const { catalog } = props;

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>Product catalog</Text>
      {catalog.isLoading ? <Text style={styles.statusDetail}>Loading products...</Text> : null}
      {catalog.errorMessage ? <Text style={styles.statusError}>{catalog.errorMessage}</Text> : null}
      {catalog.products.length === 0 ? (
        <Text style={styles.statusDetail}>Add products so inventory and AI answers have a source of truth.</Text>
      ) : (
        <View style={styles.productList}>
          {catalog.products.map((product) => (
            <ProductListItem
              key={product.id}
              onDelete={() => {
                void catalog.deleteProductById(product.id);
              }}
              onEdit={() => catalog.startEditing(product)}
              product={product}
            />
          ))}
        </View>
      )}
      <ProductForm catalog={catalog} />
    </View>
  );
}

function ProductListItem(props: {
  onDelete: () => void;
  onEdit: () => void;
  product: Product;
}): ReactElement {
  const { product } = props;

  return (
    <View style={styles.productItem}>
      <View style={styles.productHeader}>
        <Text style={styles.conversationTitle}>{product.name}</Text>
        {product.isLowStock ? <Text style={styles.lowStockBadge}>Low stock</Text> : null}
      </View>
      <Text style={styles.conversationMeta}>
        {product.sku ? `${product.sku} · ` : ''}
        {formatMoney(product.unitPriceCents, product.currency)}
      </Text>
      <Text style={styles.messagePreviewBody}>
        Stock {product.stockQuantity} · Reorder at {product.reorderThreshold}
      </Text>
      {product.description ? (
        <Text style={styles.statusDetail}>{product.description}</Text>
      ) : null}
      <View style={styles.inlineActions}>
        <SecondaryButton label="Edit" onPress={props.onEdit} />
        <SecondaryButton label="Delete" onPress={props.onDelete} />
      </View>
    </View>
  );
}

function ProductForm(props: { catalog: ReturnType<typeof useProducts> }): ReactElement {
  const { catalog } = props;
  const actionLabel = catalog.editingProductId ? 'Update product' : 'Create product';

  return (
    <View style={styles.productForm}>
      <Text style={styles.statusValue}>
        {catalog.editingProductId ? 'Edit product' : 'New product'}
      </Text>
      <TextInput
        onChangeText={(value) => catalog.setFormValue('name', value)}
        placeholder="Product name"
        style={styles.input}
        value={catalog.formValues.name}
      />
      <TextInput
        onChangeText={(value) => catalog.setFormValue('sku', value)}
        placeholder="SKU or short code"
        style={styles.input}
        value={catalog.formValues.sku}
      />
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={(value) => catalog.setFormValue('unitPrice', value)}
        placeholder="Unit price"
        style={styles.input}
        value={catalog.formValues.unitPrice}
      />
      <View style={styles.twoColumnFields}>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => catalog.setFormValue('stockQuantity', value)}
          placeholder="Stock"
          style={[styles.input, styles.flexField]}
          value={catalog.formValues.stockQuantity}
        />
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => catalog.setFormValue('reorderThreshold', value)}
          placeholder="Reorder"
          style={[styles.input, styles.flexField]}
          value={catalog.formValues.reorderThreshold}
        />
      </View>
      <TextInput
        autoCapitalize="characters"
        maxLength={3}
        onChangeText={(value) => catalog.setFormValue('currency', value)}
        placeholder="Currency"
        style={styles.input}
        value={catalog.formValues.currency}
      />
      <TextInput
        multiline
        onChangeText={(value) => catalog.setFormValue('description', value)}
        placeholder="Description"
        style={[styles.input, styles.multilineInput]}
        value={catalog.formValues.description}
      />
      <PrimaryButton
        disabled={catalog.isSaving}
        label={catalog.isSaving ? 'Saving...' : actionLabel}
        onPress={() => {
          void catalog.saveProduct();
        }}
      />
      {catalog.editingProductId ? (
        <SecondaryButton label="Cancel edit" onPress={catalog.resetForm} />
      ) : null}
    </View>
  );
}

function WhatsAppConnectionCard(props: { dashboard: OwnerDashboard }): ReactElement {
  const { whatsappConnection } = props.dashboard;
  const label = getWhatsAppStatusLabel(whatsappConnection.status);
  const detail =
    whatsappConnection.displayPhoneNumber ??
    whatsappConnection.phoneNumberId ??
    'Connect WhatsApp to start receiving customer messages.';

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>WhatsApp Business</Text>
      <Text style={styles.statusValue}>{label}</Text>
      <Text style={styles.statusDetail}>{detail}</Text>
      {whatsappConnection.lastError ? (
        <Text style={styles.statusError}>{whatsappConnection.lastError}</Text>
      ) : null}
    </View>
  );
}

function getWhatsAppStatusLabel(status: OwnerDashboard['whatsappConnection']['status']): string {
  if (status === 'connected') {
    return 'Connected';
  }

  if (status === 'pending') {
    return 'Pending verification';
  }

  if (status === 'error') {
    return 'Needs attention';
  }

  if (status === 'disabled') {
    return 'Disabled';
  }

  return 'Not connected';
}

function InboxCard(props: { inbox: ReturnType<typeof useInbox> }): ReactElement {
  const { inbox } = props;

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>Universal inbox</Text>
      {inbox.isLoading ? <Text style={styles.statusDetail}>Loading conversations...</Text> : null}
      {inbox.errorMessage ? <Text style={styles.statusError}>{inbox.errorMessage}</Text> : null}
      {!inbox.isLoading && inbox.conversations.length === 0 ? (
        <Text style={styles.statusDetail}>Customer conversations will appear here automatically.</Text>
      ) : (
        <View style={styles.inboxLayout}>
          <View style={styles.conversationList}>
            {inbox.conversations.map((conversation) => (
              <ConversationListItem
                conversation={conversation}
                isSelected={conversation.id === inbox.selectedConversation?.id}
                key={conversation.id}
                onPress={() => inbox.selectConversation(conversation.id)}
              />
            ))}
          </View>
          {inbox.selectedConversation ? (
            <ConversationThread
              conversation={inbox.selectedConversation}
              messages={inbox.messages}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function ConversationListItem(props: {
  conversation: InboxConversationSummary;
  isSelected: boolean;
  onPress: () => void;
}): ReactElement {
  const { conversation } = props;
  const label = getContactLabel(conversation);
  const latestMessage = conversation.latestMessage?.body ?? 'No messages yet';

  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.conversationItem, props.isSelected && styles.selectedConversationItem]}
    >
      <Text style={styles.conversationTitle}>{label}</Text>
      <Text style={styles.conversationMeta}>
        {conversation.contact.leadStatus ?? 'new'} lead
        {conversation.lastMessageAt ? ` · ${formatTimestamp(conversation.lastMessageAt)}` : ''}
      </Text>
      <Text style={styles.messagePreviewBody}>{latestMessage}</Text>
    </Pressable>
  );
}

function ConversationThread(props: {
  conversation: InboxConversationSummary;
  messages: WhatsAppMessagePreview[];
}): ReactElement {
  return (
    <View style={styles.threadCard}>
      <Text style={styles.statusValue}>{getContactLabel(props.conversation)}</Text>
      <Text style={styles.statusDetail}>
        {props.conversation.contact.phoneNumber ?? props.conversation.externalContactId}
      </Text>
      <Text style={styles.conversationMeta}>
        Lead status: {props.conversation.contact.leadStatus ?? 'new'}
      </Text>
      {props.messages.length === 0 ? (
        <Text style={styles.statusDetail}>No persisted messages yet.</Text>
      ) : (
        props.messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.threadMessage,
              message.direction === 'outbound' && styles.outboundThreadMessage,
            ]}
          >
            <Text style={styles.messagePreviewMeta}>
              {message.direction === 'inbound' ? 'Customer' : 'Owner'} ·{' '}
              {formatTimestamp(message.createdAt)}
            </Text>
            <Text style={styles.messagePreviewBody}>{message.body ?? message.messageStatus}</Text>
          </View>
        ))
      )}
      <SecondaryButton label="Reply via approved send path" onPress={showReplyPathNotice} />
    </View>
  );
}

function getContactLabel(conversation: InboxConversationSummary): string {
  return (
    conversation.contact.displayName ??
    conversation.contact.phoneNumber ??
    conversation.externalContactId
  );
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function formatAiDecisionReason(reason: string): string {
  return reason.replace(/_/g, ' ');
}

function showReplyPathNotice(): void {
  Alert.alert(
    'Server-side send required',
    'Outbound WhatsApp replies must route through the API send service so mobile never receives WhatsApp access tokens.',
  );
}

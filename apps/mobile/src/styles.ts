import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flexGrow: 1,
    padding: 24,
  },
  eyebrow: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 24,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    gap: 16,
    padding: 20,
  },
  heading: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  bodyText: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusCard: {
    backgroundColor: '#ecfeff',
    borderColor: '#bae6fd',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  statusLabel: {
    color: '#0369a1',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  statusDetail: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  statusError: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
  messagePreview: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    gap: 2,
    padding: 10,
  },
  messagePreviewMeta: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '700',
  },
  messagePreviewBody: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  inboxLayout: {
    gap: 12,
  },
  conversationList: {
    gap: 8,
  },
  conversationItem: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  selectedConversationItem: {
    borderColor: '#2563eb',
  },
  conversationTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  conversationMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  threadCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#bae6fd',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  threadMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    maxWidth: '88%',
    padding: 10,
  },
  outboundThreadMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#dbeafe',
  },
  metric: {
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    minWidth: '47%',
    padding: 14,
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
    padding: 12,
  },
});

import { supabase } from './supabase';

export function removeExistingRealtimeChannel(channelName: string): void {
  const topic = `realtime:${channelName}`;

  for (const channel of supabase.getChannels()) {
    if (channel.topic === topic) {
      void supabase.removeChannel(channel);
    }
  }
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { pickAndUploadProfileAvatar, readAvatarUrlFromUser } from '../lib/profileAvatar';
import { supabase } from '../lib/supabase';

type ProfileChromeContextValue = {
  avatarUrl: string | null;
  fullName: string;
  refreshProfile: () => Promise<void>;
  uploadAvatar: () => Promise<void>;
};

const ProfileChromeContext = createContext<ProfileChromeContextValue | null>(null);

export function ProfileChromeProvider(props: { children: ReactNode }): ReactElement {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');

  const refreshProfile = useCallback(async (): Promise<void> => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    setAvatarUrl(readAvatarUrlFromUser(user));
    setFullName(String(user?.user_metadata?.full_name ?? '').trim());
  }, []);

  useEffect(() => {
    void refreshProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const uploadAvatar = useCallback(async (): Promise<void> => {
    const nextUrl = await pickAndUploadProfileAvatar();
    setAvatarUrl(nextUrl);
  }, []);

  const value = useMemo(
    () => ({
      avatarUrl,
      fullName,
      refreshProfile,
      uploadAvatar,
    }),
    [avatarUrl, fullName, refreshProfile, uploadAvatar],
  );

  return <ProfileChromeContext.Provider value={value}>{props.children}</ProfileChromeContext.Provider>;
}

export function useProfileChrome(): ProfileChromeContextValue {
  const context = useContext(ProfileChromeContext);
  if (!context) {
    throw new Error('useProfileChrome must be used within ProfileChromeProvider');
  }

  return context;
}

export function useProfileChromeOptional(): ProfileChromeContextValue {
  return (
    useContext(ProfileChromeContext) ?? {
      avatarUrl: null,
      fullName: '',
      refreshProfile: async () => undefined,
      uploadAvatar: async () => undefined,
    }
  );
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, signInAnonymously } from 'firebase/auth';
import { auth, saveUserProfile, fetchUserProfile } from '../utils/firebase';
import type { UserProfile, UserRole } from '../types/Report';

interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  login: (username: string, roleInput: UserRole) => Promise<UserProfile>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isOperator: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Restore session on mount
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Fetch remote Firestore profile to check role
        const profile = await fetchUserProfile(fbUser.uid);
        if (profile) {
          setCurrentUser(profile);
        } else {
          // If Firestore profile was deleted or doesn't exist, log out
          await fbSignOut(auth);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (username: string, roleInput: UserRole): Promise<UserProfile> => {
    setLoading(true);
    try {
      // 1. Sign in anonymously in Firebase
      const credentials = await signInAnonymously(auth);
      const fbUser = credentials.user;

      if (!fbUser) throw new Error("فشل تسجيل الدخول في قاعدة البيانات");

      // 2. Set profile in Firestore based on chosen role on login screen
      const profile: UserProfile = {
        uid: fbUser.uid,
        username: username || (roleInput === 'admin' ? 'مدير النظام' : 'المشغل'),
        role: roleInput
      };

      await saveUserProfile(profile);
      setCurrentUser(profile);
      return profile;
    } catch (err) {
      console.error("Login failure", err);
      fbSignOut(auth).catch(console.warn);
      setCurrentUser(null);
      throw new Error(err instanceof Error ? err.message : "خطأ غير متوقع أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fbSignOut(auth);
      setCurrentUser(null);
    } catch (err) {
      console.error("Logout failure", err);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const isOperator = currentUser?.role === 'operator';

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout, isAdmin, isOperator }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

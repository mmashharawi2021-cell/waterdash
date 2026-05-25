import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import type { SystemSettings, DailyReport, UserProfile } from '../types/Report';

const firebaseConfig = {
  apiKey: "AIzaSyDSutT8QUKJDV756T3dzYD915BDS4k2Iw8",
  authDomain: "fridge-oracle-sza.firebaseapp.com",
  projectId: "fridge-oracle-sza",
  storageBucket: "fridge-oracle-sza.firebasestorage.app",
  messagingSenderId: "943671816209",
  appId: "1:943671816209:web:56422aa9e09bf75f2281b0"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);

// Authentication helper
export async function ensureAuthenticated() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error("Firebase anonymous sign-in failed", err);
    }
  }
}

// 1. User Profiles RBAC helpers
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', uid);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
  } catch (err) {
    console.error("Error fetching user profile", err);
  }
  return null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const docRef = doc(db, 'users', profile.uid);
  await setDoc(docRef, {
    ...profile,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// 2. Settings Fetch & Save
export async function fetchSystemSettings(): Promise<SystemSettings> {
  await ensureAuthenticated();
  const docRef = doc(db, 'settings', 'main');
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        submersibleProductionPerHour: Number(data.submersibleProductionPerHour || 55),
        filteredProductionPerHour: Number(data.filteredProductionPerHour || 33),
        defaultStationName: String(data.defaultStationName || "المحطة الرئيسية")
      };
    }
  } catch (err) {
    console.warn("Failed to fetch settings from Firestore, using local defaults", err);
  }
  return {
    submersibleProductionPerHour: 55,
    filteredProductionPerHour: 33,
    defaultStationName: "المحطة الرئيسية"
  };
}

export async function saveSystemSettings(settings: SystemSettings): Promise<void> {
  await ensureAuthenticated();
  const docRef = doc(db, 'settings', 'main');
  await setDoc(docRef, {
    submersibleProductionPerHour: Number(settings.submersibleProductionPerHour),
    filteredProductionPerHour: Number(settings.filteredProductionPerHour),
    defaultStationName: String(settings.defaultStationName),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// 3. Fetch Previous Day's Balance
export async function fetchPreviousBalance(currentDate: string): Promise<number> {
  await ensureAuthenticated();
  const reportsRef = collection(db, 'reports');
  try {
    const q = query(
      reportsRef,
      where('date', '<', currentDate),
      orderBy('date', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const report = snapshot.docs[0].data() as DailyReport;
      return Number(report.fuel?.currentBalance ?? 0);
    }
  } catch (err) {
    console.error("Error fetching previous balance from Firestore", err);
  }
  return 0;
}

// 4. Save New Report
export async function saveDailyReport(report: DailyReport): Promise<string> {
  await ensureAuthenticated();
  const reportsRef = collection(db, 'reports');
  const docRef = await addDoc(reportsRef, {
    ...report,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

// 5. Update/Edit Report
export async function updateDailyReport(reportId: string, report: DailyReport): Promise<void> {
  await ensureAuthenticated();
  const docRef = doc(db, 'reports', reportId);
  await setDoc(docRef, {
    ...report,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// 6. Delete Report
export async function deleteDailyReport(reportId: string): Promise<void> {
  await ensureAuthenticated();
  const docRef = doc(db, 'reports', reportId);
  // Direct deletion
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(docRef);
}

// 7. Fetch Month Reports
export async function fetchMonthReports(yearMonth: string): Promise<DailyReport[]> {
  await ensureAuthenticated();
  const reportsRef = collection(db, 'reports');
  try {
    // yearMonth is like "2026-05"
    // Fetch reports starting from "2026-05-01" to "2026-05-31"
    const startStr = `${yearMonth}-01`;
    const endStr = `${yearMonth}-31`; // Covers standard month
    const q = query(
      reportsRef,
      where('date', '>=', startStr),
      where('date', '<=', endStr),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyReport));
  } catch (err) {
    console.error("Error fetching monthly reports", err);
    return [];
  }
}

// 8. Fetch All Reports (for Dashboard preview)
export async function fetchAllReports(): Promise<DailyReport[]> {
  await ensureAuthenticated();
  const reportsRef = collection(db, 'reports');
  try {
    const q = query(reportsRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyReport));
  } catch (err) {
    console.error("Error fetching all reports", err);
    return [];
  }
}

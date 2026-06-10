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
import type { SystemSettings, DailyReport, UserProfile, FuelEntry } from '../types/Report';

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

// 2. Settings Fetch & Save (With Double Schema Mapping)
export async function fetchSystemSettings(): Promise<SystemSettings> {
  await ensureAuthenticated();
  const docRef = doc(db, 'settings', 'main');
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        // Support both old "submersibleRate" and new "submersibleProductionPerHour"
        submersibleProductionPerHour: Number(data.submersibleRate || data.submersibleProductionPerHour || 55),
        filteredProductionPerHour: Number(data.filteredRate || data.filteredProductionPerHour || 33),
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
    // Write both fields to ensure 100% backward & forward database compatibility
    submersibleRate: Number(settings.submersibleProductionPerHour),
    submersibleProductionPerHour: Number(settings.submersibleProductionPerHour),
    filteredRate: Number(settings.filteredProductionPerHour),
    filteredProductionPerHour: Number(settings.filteredProductionPerHour),
    defaultStationName: String(settings.defaultStationName),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// 3. Fetch Previous Day's Balance (With reportDate chronological query)
export async function fetchPreviousBalance(currentDate: string): Promise<number> {
  await ensureAuthenticated();
  const reportsRef = collection(db, 'reports');
  try {
    // We query by legacy "reportDate" to read existing database entries correctly
    const q = query(
      reportsRef,
      where('reportDate', '<', currentDate),
      orderBy('reportDate', 'desc'),
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

// 4. Save New Report (Writes both date and reportDate)
export async function saveDailyReport(report: DailyReport): Promise<string> {
  await ensureAuthenticated();
  const reportsRef = collection(db, 'reports');
  const docRef = await addDoc(reportsRef, {
    ...report,
    reportDate: report.date, // support legacy database key
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
    reportDate: report.date,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// 6. Delete Report
export async function deleteDailyReport(reportId: string): Promise<void> {
  await ensureAuthenticated();
  const docRef = doc(db, 'reports', reportId);
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(docRef);
}

// 7. Fetch Month Reports (With double-field fallback)
export async function fetchMonthReports(yearMonth: string): Promise<DailyReport[]> {
  await ensureAuthenticated();
  const reportsRef = collection(db, 'reports');
  try {
    const startStr = `${yearMonth}-01`;
    const endStr = `${yearMonth}-31`;
    const q = query(
      reportsRef,
      where('reportDate', '>=', startStr),
      where('reportDate', '<=', endStr),
      orderBy('reportDate', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date || data.reportDate, // map reportDate back to date for React state
      } as DailyReport;
    });
  } catch (err) {
    console.error("Error fetching monthly reports", err);
    return [];
  }
}

// 8. Fetch All Reports (With double-field fallback)
export async function fetchAllReports(): Promise<DailyReport[]> {
  await ensureAuthenticated();
  const reportsRef = collection(db, 'reports');
  try {
    const q = query(reportsRef, orderBy('reportDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date || data.reportDate, // map reportDate back to date for React state
      } as DailyReport;
    });
  } catch (err) {
    console.error("Error fetching all reports", err);
    return [];
  }
}

// --- Fuel Entries CRUD Operations ---

export async function fetchFuelEntries(date?: string): Promise<FuelEntry[]> {
  await ensureAuthenticated();
  const fuelRef = collection(db, 'fuelEntries');
  try {
    let q;
    if (date) {
      q = query(fuelRef, where('date', '==', date));
    } else {
      q = query(fuelRef, orderBy('date', 'desc'));
    }
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as FuelEntry;
    });
    
    // Sort in memory by date desc, then by createdAt seconds desc
    entries.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
    
    return entries;
  } catch (err) {
    console.error("Error fetching fuel entries", err);
    return [];
  }
}

export async function saveFuelEntry(entry: FuelEntry): Promise<string> {
  await ensureAuthenticated();
  const fuelRef = collection(db, 'fuelEntries');
  const docRef = await addDoc(fuelRef, {
    ...entry,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function deleteFuelEntry(entryId: string): Promise<void> {
  await ensureAuthenticated();
  const docRef = doc(db, 'fuelEntries', entryId);
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(docRef);
}


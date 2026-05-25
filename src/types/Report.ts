// Types for Water Pumping & Operation Dashboard

export interface SystemSettings {
  submersibleProductionPerHour: number;
  filteredProductionPerHour: number;
  defaultStationName: string;
  updatedAt?: any;
}

export interface Beneficiary {
  agencyName: string;
  quantity: number;
  numberOfCars: number;
}

export interface LabTests {
  phDesalination: number; // PH after desalination (بعد التحلية)
  phSubmersible: number;  // PH submersible (مياه الغاطس)
  tdsDesalinated: number; // TDS desalinated (مياه محلاة)
  tdsWell: number;        // TDS well (بئر مياه)
  tdsWaste: number;       // TDS waste (عادم)
  freeChlorine: number;   // Free Chlorine (الكلور الحر)
}

export interface GeneratorOperation {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  operatingHours: number; // Decimal hours, e.g., 2.5
  formattedOperatingHours: string; // "HH:MM" format
}

export interface FuelData {
  addedFuel: number;                // المضاف يومياً
  consumedFuel: number;             // المستهلك يومياً
  suppliedFromMunicipality: number; // المورد من البلدية
  previousBalance: number;          // الرصيد السابق
  currentBalance: number;           // الرصيد الحالي
}

export interface WaterQuantities {
  totalWaterIn: number;     // calculated: operatingHours * submersibleProductionPerHour
  dailyProduction: number;  // calculated: operatingHours * filteredProductionPerHour
  wasteWater: number;       // calculated: totalWaterIn - dailyProduction
  recoveryRate: number;     // calculated %: (dailyProduction / totalWaterIn) * 100
  wasteRate: number;        // calculated %: 100 - recoveryRate
}

export interface DailyReport {
  id?: string;
  date: string;
  stationName: string;
  generator: GeneratorOperation;
  fuel: FuelData;
  labTests: LabTests;
  beneficiaries: Beneficiary[];
  waterQuantities: WaterQuantities;
  beneficiariesTotals: {
    totalQuantity: number;
    totalCars: number;
  };
  createdAt?: any;
  updatedAt?: any;
}

export type UserRole = 'admin' | 'operator';

export interface UserProfile {
  uid: string;
  username: string;
  role: UserRole;
  stationName?: string;
}


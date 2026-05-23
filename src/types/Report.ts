// Types for Water Report System

export interface GeneratorData {
  startTime: string; // HH:mm format
  stopTime: string; // HH:mm format
  operatingHours: number; // Calculated automatically
}

export interface FuelData {
  previousBalance: number; // كمية السولار المتبقية من التقرير السابق
  fuelAdded: number; // السولار المضاف اليوم
  fuelConsumptionPerHour: number; // استهلاك السولار في الساعة
  totalAvailable: number; // المخزون الكلي المتاح
  fuelConsumed: number; // Calculated: operatingHours * fuelConsumptionPerHour
  remainingBalance: number; // Calculated: totalAvailable - fuelConsumed
}

export interface WaterData {
  pumpProduction: number; // إجمالي انتاج الغاطس في اليوم (كوب/ساعة × عدد الساعات)
  desaltedWater: number; // Calculated: pumpProduction - wasteWater
  wasteWater: number; // كمية المياه العادمة
}

export interface ReportData {
  id: string;
  date: string;
  station: string;
  operator: string;
  generator: GeneratorData;
  fuel: FuelData;
  water: WaterData;
  beneficiaries: BeneficiaryData[];
  waterTests: WaterTestData;
  createdAt: string;
  updatedAt: string;
}

export interface BeneficiaryData {
  id: string;
  name: string;
  quantity: number;
  vehicles: number;
}

export interface WaterTestData {
  ph: number;
  tds: number;
  chlorine: number;
  turbidity: number;
}

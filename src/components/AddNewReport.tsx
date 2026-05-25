import React, { useEffect, useState } from 'react';
import { 
  ClipboardList, 
  Calendar, 
  Building2, 
  Clock, 
  Droplet, 
  Flame, 
  Beaker, 
  Users, 
  Plus, 
  Trash2, 
  Save, 
  ArrowRight,
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Percent
} from 'lucide-react';
import { fetchSystemSettings, fetchPreviousBalance, saveDailyReport } from '../utils/firebase';
import { reportValidationSchema, calculateHours } from '../utils/validationSchema';
import type { DailyReport } from '../types/Report';

interface AddNewReportProps {
  onBack?: () => void;
  onSuccess?: () => void;
}

export const AddNewReport: React.FC<AddNewReportProps> = ({ onBack, onSuccess }) => {
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);
  const [loadingPrevBalance, setLoadingPrevBalance] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Zod Validation Errors State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Settings loaded from db
  const [settings, setSettings] = useState({
    submersibleProductionPerHour: 55,
    filteredProductionPerHour: 33,
    defaultStationName: 'المحطة الرئيسية',
  });

  // --- Manual Inputs ---
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [stationName, setStationName] = useState<string>('');
  
  // Generator & Time
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');

  // Fuel (strings to allow empty state input)
  const [addedFuel, setAddedFuel] = useState<string>('0');
  const [consumedFuel, setConsumedFuel] = useState<string>('0');
  const [suppliedFromMunicipality, setSuppliedFromMunicipality] = useState<string>('0');
  const [previousBalance, setPreviousBalance] = useState<number>(0);

  // Lab Tests
  const [phDesalination, setPhDesalination] = useState<string>('7.2');
  const [phSubmersible, setPhSubmersible] = useState<string>('7.6');
  const [tdsDesalinated, setTdsDesalinated] = useState<string>('120');
  const [tdsWell, setTdsWell] = useState<string>('2400');
  const [tdsWaste, setTdsWaste] = useState<string>('4200');
  const [freeChlorine, setFreeChlorine] = useState<string>('0.5');

  // Dynamic Beneficiaries (Agency, Quantity, Cars)
  const [beneficiaries, setBeneficiaries] = useState<Array<{
    agencyName: string;
    quantity: string;
    numberOfCars: string;
  }>>([
    { agencyName: 'بلدية المنطقة', quantity: '150', numberOfCars: '10' }
  ]);

  // Load Settings on Mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const fetched = await fetchSystemSettings();
        setSettings(fetched);
        setStationName(fetched.defaultStationName);
      } catch (err) {
        console.warn("Failed to fetch settings, using local fallbacks", err);
        setStationName("المحطة الرئيسية");
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  // Fetch Previous Balance on Date change
  useEffect(() => {
    async function loadBalance() {
      if (!date) return;
      setLoadingPrevBalance(true);
      try {
        const balance = await fetchPreviousBalance(date);
        setPreviousBalance(balance);
      } catch (err) {
        console.error("Failed to load previous balance", err);
        setPreviousBalance(0);
      } finally {
        setLoadingPrevBalance(false);
      }
    }
    loadBalance();
  }, [date]);

  // Toast notifier
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // --- Auto-Calculations (Reactive Computed Constants) ---

  // 1. Operation Hours
  const computedHours = React.useMemo(() => {
    const hoursDecimal = calculateHours(startTime, endTime);
    if (hoursDecimal <= 0) return { decimal: 0, formatted: '00:00' };

    const totalMinutes = Math.round(hoursDecimal * 60);
    const hoursPart = Math.floor(totalMinutes / 60);
    const minutesPart = totalMinutes % 60;
    const formatted = `${String(hoursPart).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')}`;
    
    return { decimal: hoursDecimal, formatted };
  }, [startTime, endTime]);

  // 2. Water quantities
  const computedWater = React.useMemo(() => {
    const hours = computedHours.decimal;
    const totalWaterIn = parseFloat((hours * settings.submersibleProductionPerHour).toFixed(2)) || 0;
    const dailyProduction = parseFloat((hours * settings.filteredProductionPerHour).toFixed(2)) || 0;
    const wasteWater = parseFloat((totalWaterIn - dailyProduction).toFixed(2)) || 0;
    
    let recoveryRate = 0;
    if (totalWaterIn > 0) {
      recoveryRate = parseFloat(((dailyProduction / totalWaterIn) * 100).toFixed(2));
    }
    const wasteRate = parseFloat((100 - recoveryRate).toFixed(2));
    
    return {
      totalWaterIn,
      dailyProduction,
      wasteWater,
      recoveryRate,
      wasteRate
    };
  }, [computedHours.decimal, settings.submersibleProductionPerHour, settings.filteredProductionPerHour]);

  // 3. Beneficiaries totals
  const computedBeneficiariesTotals = React.useMemo(() => {
    return beneficiaries.reduce(
      (acc, curr) => {
        acc.totalQuantity += parseFloat(curr.quantity) || 0;
        acc.totalCars += parseInt(curr.numberOfCars) || 0;
        return acc;
      },
      { totalQuantity: 0, totalCars: 0 }
    );
  }, [beneficiaries]);

  // 4. Fuel Balance calculations
  const computedFuelBalance = React.useMemo(() => {
    const parsedAdded = parseFloat(addedFuel) || 0;
    const parsedConsumed = parseFloat(consumedFuel) || 0;
    const parsedSupplied = parseFloat(suppliedFromMunicipality) || 0;
    const balance = parseFloat((previousBalance + parsedAdded + parsedSupplied - parsedConsumed).toFixed(2));
    return isNaN(balance) ? 0 : balance;
  }, [previousBalance, addedFuel, consumedFuel, suppliedFromMunicipality]);

  const isFuelBalanceNegative = computedFuelBalance < 0;

  // Dynamic Beneficiary Management
  const addBeneficiaryRow = () => {
    setBeneficiaries((prev) => [...prev, { agencyName: '', quantity: '0', numberOfCars: '0' }]);
  };

  const removeBeneficiaryRow = (index: number) => {
    if (beneficiaries.length === 1) {
      showToast('يجب إدخال جهة مستفيدة واحدة على الأقل في التقرير', 'error');
      return;
    }
    setBeneficiaries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBeneficiaryChange = (index: number, field: 'agencyName' | 'quantity' | 'numberOfCars', value: string) => {
    setBeneficiaries((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value
      };
      return next;
    });
  };

  // Form Validation Engine
  const validateForm = (): boolean => {
    const payload = {
      date,
      stationName,
      generator: { startTime, endTime },
      fuel: {
        addedFuel: parseFloat(addedFuel) || 0,
        consumedFuel: parseFloat(consumedFuel) || 0,
        suppliedFromMunicipality: parseFloat(suppliedFromMunicipality) || 0
      },
      labTests: {
        phDesalination: parseFloat(phDesalination) || 0,
        phSubmersible: parseFloat(phSubmersible) || 0,
        tdsDesalinated: parseFloat(tdsDesalinated) || 0,
        tdsWell: parseFloat(tdsWell) || 0,
        tdsWaste: parseFloat(tdsWaste) || 0,
        freeChlorine: parseFloat(freeChlorine) || 0
      },
      beneficiaries: beneficiaries.map(b => ({
        agencyName: b.agencyName,
        quantity: parseFloat(b.quantity) || 0,
        numberOfCars: parseInt(b.numberOfCars) || 0
      }))
    };

    const result = reportValidationSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      showToast('الرجاء تصحيح الأخطاء الموضحة باللون الأحمر قبل الحفظ', 'error');
      return false;
    }
    setErrors({});
    return true;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Fuel Balance check guard
    if (isFuelBalanceNegative) {
      showToast('❌ خطأ: لا يمكن إرسال التقرير لأن رصيد السولار الحالي سالب!', 'error');
      return;
    }

    // Run Zod schema validation checks
    if (!validateForm()) return;

    setSubmitting(true);

    const parsedReport: DailyReport = {
      date,
      stationName,
      generator: {
        startTime,
        endTime,
        operatingHours: computedHours.decimal,
        formattedOperatingHours: computedHours.formatted
      },
      fuel: {
        addedFuel: parseFloat(addedFuel) || 0,
        consumedFuel: parseFloat(consumedFuel) || 0,
        suppliedFromMunicipality: parseFloat(suppliedFromMunicipality) || 0,
        previousBalance,
        currentBalance: computedFuelBalance
      },
      labTests: {
        phDesalination: parseFloat(phDesalination) || 0,
        phSubmersible: parseFloat(phSubmersible) || 0,
        tdsDesalinated: parseFloat(tdsDesalinated) || 0,
        tdsWell: parseFloat(tdsWell) || 0,
        tdsWaste: parseFloat(tdsWaste) || 0,
        freeChlorine: parseFloat(freeChlorine) || 0
      },
      beneficiaries: beneficiaries.map(b => ({
        agencyName: b.agencyName,
        quantity: parseFloat(b.quantity) || 0,
        numberOfCars: parseInt(b.numberOfCars) || 0
      })),
      waterQuantities: computedWater,
      beneficiariesTotals: {
        totalQuantity: computedBeneficiariesTotals.totalQuantity,
        totalCars: computedBeneficiariesTotals.totalCars
      }
    };

    try {
      await saveDailyReport(parsedReport);
      showToast('🎉 تم حفظ وإرسال التقرير اليومي بنجاح إلى Firebase!', 'success');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else if (onBack) onBack();
      }, 1500);
    } catch (err) {
      showToast('فشل في حفظ التقرير في قاعدة البيانات.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[90vh] flex flex-col p-6 text-right font-sans" dir="rtl">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 left-6 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 transform scale-100 ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/5'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">إضافة تقرير تشغيل جديد</h1>
            <p className="text-sm text-gray-400 mt-1">تعبئة البيانات اليومية لضخ المياه وفحوصات الجودة والوقود المستهلك</p>
          </div>
        </div>
        
        {onBack && (
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:border-sky-500/30 bg-white/5 hover:bg-sky-500/5 text-gray-300 hover:text-sky-400 font-bold transition-all duration-300"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
        )}
      </div>

      {loadingSettings ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 bg-[#0f1424]/30 border border-white/5 backdrop-blur-md rounded-3xl">
          <RefreshCw className="w-10 h-10 text-sky-400 animate-spin" />
          <span className="text-gray-400 font-medium">جاري تحميل إعدادات النظام من Firebase...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          
          {/* Row 1: General Info Card */}
          <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl flex flex-col md:flex-row gap-6 hover:border-sky-500/10 transition-all duration-500">
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-gray-300 text-sm font-semibold mb-1">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span>تاريخ التقرير اليومي (Report Date)</span>
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 font-bold transition-all ${
                  errors.date ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-sky-500'
                }`}
                required
              />
              {errors.date && (
                <span className="text-xs text-rose-400 mt-1 font-semibold">{errors.date}</span>
              )}
            </div>
            
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-gray-300 text-sm font-semibold mb-1">
                <Building2 className="w-4 h-4 text-sky-400" />
                <span>اسم المحطة وضخ المياه (Station Name)</span>
              </div>
              <input
                type="text"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="اسم المحطة الافتراضي"
                className={`bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 font-medium transition-all ${
                  errors.stationName ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-sky-500'
                }`}
                required
              />
              {errors.stationName && (
                <span className="text-xs text-rose-400 mt-1 font-semibold">{errors.stationName}</span>
              )}
            </div>
          </div>

          {/* Row 2: Two Column Grid (Operations & Quantities) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Card A: Generator & Operations */}
            <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl flex flex-col gap-6 hover:border-sky-500/10 transition-all duration-500 group">
              <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                <Clock className="w-5 h-5 text-sky-400" />
                <h3 className="text-lg font-bold text-white">بيانات تشغيل المولد والزمن</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 font-semibold">وقت البدء (Start Time)</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-[#161b30]/60 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 font-bold transition-all"
                    required
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 font-semibold">وقت الإيقاف (End Time)</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 font-bold transition-all ${
                      errors['generator.endTime'] ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-sky-500'
                    }`}
                    required
                  />
                </div>
              </div>

              {errors['generator.endTime'] && (
                <span className="text-xs text-rose-400 -mt-2 font-semibold block">{errors['generator.endTime']}</span>
              )}

              {/* Read-Only: Calculated Operating Hours */}
              <div className="flex justify-between items-center bg-white/5 border border-white/5 p-4 rounded-2xl">
                <span className="text-sm font-semibold text-gray-400">ساعات التشغيل المحسوبة تلقائياً:</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-medium">({computedHours.decimal} ساعة عشرية)</span>
                  <span className="text-lg font-extrabold text-sky-400 bg-sky-500/10 px-4 py-1.5 rounded-xl border border-sky-500/20">
                    {computedHours.formatted}
                  </span>
                </div>
              </div>
            </div>

            {/* Card B: Water Quantities (Calculated & Read-only) */}
            <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl flex flex-col gap-5 hover:border-blue-500/10 transition-all duration-500 group">
              <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                <Droplet className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">تحليلات وكميات المياه (محسوب تلقائياً)</h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#161b30]/40 border border-white/5 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-400 font-semibold mb-1">إجمالي المياه الداخلة</span>
                  <strong className="text-base font-extrabold text-white">{computedWater.totalWaterIn} ك</strong>
                  <span className="text-[9px] text-gray-500 mt-1">ساعات × {settings.submersibleProductionPerHour} م³</span>
                </div>
                
                <div className="bg-[#161b30]/40 border border-white/5 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-400 font-semibold mb-1">الإنتاج اليومي المحلى</span>
                  <strong className="text-base font-extrabold text-emerald-400">{computedWater.dailyProduction} ك</strong>
                  <span className="text-[9px] text-gray-500 mt-1">ساعات × {settings.filteredProductionPerHour} م³</span>
                </div>

                <div className="bg-[#161b30]/40 border border-white/5 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-gray-400 font-semibold mb-1">المياه العادمة</span>
                  <strong className="text-base font-extrabold text-rose-400">{computedWater.wasteWater} ك</strong>
                  <span className="text-[9px] text-gray-500 mt-1">الداخلة - المنتجة</span>
                </div>
              </div>

              {/* Recovery & Waste Rates */}
              <div className="grid grid-cols-2 gap-4 mt-1">
                <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>معدل الاسترجاع</span>
                  </div>
                  <strong className="text-base font-bold text-emerald-400">{computedWater.recoveryRate}%</strong>
                </div>

                <div className="flex items-center justify-between bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold">
                    <Percent className="w-3.5 h-3.5" />
                    <span>معدل الفاقد / العادم</span>
                  </div>
                  <strong className="text-base font-bold text-rose-400">{computedWater.wasteRate}%</strong>
                </div>
              </div>
            </div>

          </div>

          {/* Row 3: Fuel Operations & Balance */}
          <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl flex flex-col gap-6 hover:border-amber-500/10 transition-all duration-500 group">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Flame className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-white">بيانات وجرد وقود السولار (Fuel Liters)</h3>
              </div>
              
              {loadingPrevBalance && (
                <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري تحديث الرصيد السابق...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Previous Balance (Read only fetched) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-semibold">رصيد سولار سابق (لتر)</label>
                <div className="bg-[#161b30]/40 border border-white/5 rounded-2xl py-3.5 px-4 text-gray-400 font-bold">
                  {previousBalance} لتر
                </div>
                <span className="text-[10px] text-gray-500">تم جلبه آلياً من التقرير السابق</span>
              </div>

              {/* Added Fuel */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-semibold">السولار المضاف اليوم (المضاف يومياً)</label>
                <input
                  type="number"
                  value={addedFuel}
                  onChange={(e) => setAddedFuel(e.target.value)}
                  placeholder="0"
                  className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 font-bold transition-all ${
                    errors['fuel.addedFuel'] ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-sky-500'
                  }`}
                  min="0"
                  step="0.1"
                />
                {errors['fuel.addedFuel'] && (
                  <span className="text-xs text-rose-400 font-semibold">{errors['fuel.addedFuel']}</span>
                )}
              </div>

              {/* Supplied from Municipality */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-semibold">المورد من البلدية (لتر)</label>
                <input
                  type="number"
                  value={suppliedFromMunicipality}
                  onChange={(e) => setSuppliedFromMunicipality(e.target.value)}
                  placeholder="0"
                  className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 font-bold transition-all ${
                    errors['fuel.suppliedFromMunicipality'] ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-sky-500'
                  }`}
                  min="0"
                  step="0.1"
                />
                {errors['fuel.suppliedFromMunicipality'] && (
                  <span className="text-xs text-rose-400 font-semibold">{errors['fuel.suppliedFromMunicipality']}</span>
                )}
              </div>

              {/* Consumed Fuel */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-semibold">السولار المستهلك (المستهلك يومياً)</label>
                <input
                  type="number"
                  value={consumedFuel}
                  onChange={(e) => setConsumedFuel(e.target.value)}
                  placeholder="0"
                  className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 font-bold transition-all ${
                    errors['fuel.consumedFuel'] ? 'border-rose-500 focus:border-rose-500' : 'border-white/10 focus:border-sky-500'
                  }`}
                  min="0"
                  step="0.1"
                />
                {errors['fuel.consumedFuel'] && (
                  <span className="text-xs text-rose-400 font-semibold">{errors['fuel.consumedFuel']}</span>
                )}
              </div>

            </div>

            {/* Read-Only computed balance alert */}
            <div className={`flex justify-between items-center p-4 rounded-2xl border ${
              isFuelBalanceNegative 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-lg shadow-rose-500/5' 
                : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
            }`}>
              <div className="flex items-center gap-2">
                {isFuelBalanceNegative && <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 animate-bounce" />}
                <span className="text-sm font-semibold">الرصيد المتبقي الحالي (Current Balance):</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium opacity-85">({previousBalance} + {addedFuel || 0} + {suppliedFromMunicipality || 0} - {consumedFuel || 0})</span>
                <strong className={`text-xl font-extrabold px-5 py-1.5 rounded-xl border ${
                  isFuelBalanceNegative ? 'bg-rose-500/20 border-rose-500/30' : 'bg-emerald-500/20 border-emerald-500/30'
                }`}>
                  {computedFuelBalance} لتر
                </strong>
              </div>
            </div>
            {isFuelBalanceNegative && (
              <span className="text-xs text-rose-400 -mt-3 font-semibold text-left block">
                ⚠️ تنبيه: لا يمكن حفظ التقرير برصيد وقود سالب! يرجى مراجعة قيم الاستهلاك والمخزون المضاف.
              </span>
            )}
          </div>

          {/* Row 4: Lab Quality Tests */}
          <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl flex flex-col gap-6 hover:border-emerald-500/10 transition-all duration-500 group">
            <div className="flex items-center gap-3 pb-3 border-b border-white/5">
              <Beaker className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">فحوصات جودة ومختبر المياه (Lab Tests)</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-400 font-semibold">الأس الهيدروجيني بعد التحلية</label>
                <input
                  type="number"
                  value={phDesalination}
                  onChange={(e) => setPhDesalination(e.target.value)}
                  className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-sky-500 font-bold transition-all ${
                    errors['labTests.phDesalination'] ? 'border-rose-500' : 'border-white/10'
                  }`}
                  step="0.01"
                  min="0"
                  max="14"
                />
                {errors['labTests.phDesalination'] && (
                  <span className="text-[9px] text-rose-400 font-semibold">{errors['labTests.phDesalination']}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-400 font-semibold">الأس الهيدروجيني للغاطس</label>
                <input
                  type="number"
                  value={phSubmersible}
                  onChange={(e) => setPhSubmersible(e.target.value)}
                  className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-sky-500 font-bold transition-all ${
                    errors['labTests.phSubmersible'] ? 'border-rose-500' : 'border-white/10'
                  }`}
                  step="0.01"
                  min="0"
                  max="14"
                />
                {errors['labTests.phSubmersible'] && (
                  <span className="text-[9px] text-rose-400 font-semibold">{errors['labTests.phSubmersible']}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-400 font-semibold">الملوحة مياه محلاة (TDS)</label>
                <input
                  type="number"
                  value={tdsDesalinated}
                  onChange={(e) => setTdsDesalinated(e.target.value)}
                  className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-sky-500 font-bold transition-all ${
                    errors['labTests.tdsDesalinated'] ? 'border-rose-500' : 'border-white/10'
                  }`}
                  step="1"
                  min="0"
                />
                {errors['labTests.tdsDesalinated'] && (
                  <span className="text-[9px] text-rose-400 font-semibold">{errors['labTests.tdsDesalinated']}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-400 font-semibold">الملوحة بئر مياه (TDS)</label>
                <input
                  type="number"
                  value={tdsWell}
                  onChange={(e) => setTdsWell(e.target.value)}
                  className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-sky-500 font-bold transition-all ${
                    errors['labTests.tdsWell'] ? 'border-rose-500' : 'border-white/10'
                  }`}
                  step="1"
                  min="0"
                />
                {errors['labTests.tdsWell'] && (
                  <span className="text-[9px] text-rose-400 font-semibold">{errors['labTests.tdsWell']}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-400 font-semibold">الملوحة مياه عادمة (TDS)</label>
                <input
                  type="number"
                  value={tdsWaste}
                  onChange={(e) => setTdsWaste(e.target.value)}
                  className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-sky-500 font-bold transition-all ${
                    errors['labTests.tdsWaste'] ? 'border-rose-500' : 'border-white/10'
                  }`}
                  step="1"
                  min="0"
                />
                {errors['labTests.tdsWaste'] && (
                  <span className="text-[9px] text-rose-400 font-semibold">{errors['labTests.tdsWaste']}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-400 font-semibold">الكلور الحر (Free Chlorine)</label>
                <input
                  type="number"
                  value={freeChlorine}
                  onChange={(e) => setFreeChlorine(e.target.value)}
                  className={`w-full bg-[#161b30]/60 border rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-sky-500 font-bold transition-all ${
                    errors['labTests.freeChlorine'] ? 'border-rose-500' : 'border-white/10'
                  }`}
                  step="0.01"
                  min="0"
                />
                {errors['labTests.freeChlorine'] && (
                  <span className="text-[9px] text-rose-400 font-semibold">{errors['labTests.freeChlorine']}</span>
                )}
              </div>

            </div>
          </div>

          {/* Row 5: Dynamic Beneficiaries List */}
          <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl flex flex-col gap-6 hover:border-purple-500/10 transition-all duration-500 group">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">الجهات المستفيدة والتوزيع (Beneficiaries)</h3>
              </div>
              
              <button
                type="button"
                onClick={addBeneficiaryRow}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white font-semibold transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة جهة</span>
              </button>
            </div>

            {errors.beneficiaries && (
              <span className="text-xs text-rose-400 font-semibold">{errors.beneficiaries}</span>
            )}

            {/* Dynamic Beneficiary rows */}
            <div className="flex flex-col gap-4">
              {beneficiaries.map((b, idx) => (
                <div key={idx} className="flex flex-col gap-2 bg-white/5 p-4 rounded-2xl border border-white/5 relative group">
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                    <div className="flex-1 w-full flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-400 font-semibold">اسم الجهة المستفيدة (Agency Name)</label>
                      <input
                        type="text"
                        value={b.agencyName}
                        onChange={(e) => handleBeneficiaryChange(idx, 'agencyName', e.target.value)}
                        placeholder="مثال: جهة خيرية، حي محلي، إلخ"
                        className={`bg-[#161b30]/60 border rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-sky-500 text-sm font-medium transition-all ${
                          errors[`beneficiaries.${idx}.agencyName`] ? 'border-rose-500' : 'border-white/10'
                        }`}
                        required
                      />
                    </div>

                    <div className="w-full sm:w-40 flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-400 font-semibold">الكمية الموزعة (م³)</label>
                      <input
                        type="number"
                        value={b.quantity}
                        onChange={(e) => handleBeneficiaryChange(idx, 'quantity', e.target.value)}
                        placeholder="0"
                        className={`bg-[#161b30]/60 border rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-sky-500 text-sm font-bold transition-all ${
                          errors[`beneficiaries.${idx}.quantity`] ? 'border-rose-500' : 'border-white/10'
                        }`}
                        min="0"
                        step="0.1"
                        required
                      />
                    </div>

                    <div className="w-full sm:w-40 flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-400 font-semibold">عدد السيارات الناقلة</label>
                      <input
                        type="number"
                        value={b.numberOfCars}
                        onChange={(e) => handleBeneficiaryChange(idx, 'numberOfCars', e.target.value)}
                        placeholder="0"
                        className={`bg-[#161b30]/60 border rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-sky-500 text-sm font-bold transition-all ${
                          errors[`beneficiaries.${idx}.numberOfCars`] ? 'border-rose-500' : 'border-white/10'
                        }`}
                        min="0"
                        step="1"
                        required
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeBeneficiaryRow(idx)}
                      className="self-end sm:self-center shrink-0 w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all duration-300"
                      title="حذف هذا السطر"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Errors subtext */}
                  <div className="flex flex-col gap-1 pr-2">
                    {errors[`beneficiaries.${idx}.agencyName`] && (
                      <span className="text-[10px] text-rose-400 font-semibold">{errors[`beneficiaries.${idx}.agencyName`]}</span>
                    )}
                    {errors[`beneficiaries.${idx}.quantity`] && (
                      <span className="text-[10px] text-rose-400 font-semibold">{errors[`beneficiaries.${idx}.quantity`]}</span>
                    )}
                    {errors[`beneficiaries.${idx}.numberOfCars`] && (
                      <span className="text-[10px] text-rose-400 font-semibold">{errors[`beneficiaries.${idx}.numberOfCars`]}</span>
                    )}
                  </div>

                </div>
              ))}
            </div>

            {/* Dynamic Beneficiaries Totals Card */}
            <div className="flex justify-between items-center bg-[#161b30]/40 border border-white/5 p-4 rounded-2xl mt-2 text-gray-300">
              <span className="text-sm font-semibold">إجمالي التوزيع المحسوب تلقائياً (Beneficiaries Totals):</span>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 text-sm font-bold">
                <div>
                  <span className="text-xs text-gray-400 font-medium ml-2">مجموع الكمية:</span>
                  <span className="text-base text-purple-400 font-extrabold">{computedBeneficiariesTotals.totalQuantity} م³</span>
                </div>
                <div className="hidden sm:block text-white/10">|</div>
                <div>
                  <span className="text-xs text-gray-400 font-medium ml-2">مجموع السيارات:</span>
                  <span className="text-base text-purple-400 font-extrabold">{computedBeneficiariesTotals.totalCars} سيارة</span>
                </div>
              </div>
            </div>

          </div>

          {/* Form Actions Footer */}
          <div className="flex justify-end gap-4 bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl">
            <button
              type="submit"
              disabled={submitting || isFuelBalanceNegative}
              className={`flex items-center gap-2 px-10 py-4 rounded-2xl text-white text-base font-extrabold shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 ${
                isFuelBalanceNegative 
                  ? 'bg-rose-600/50 hover:bg-rose-600/50 cursor-not-allowed border border-rose-500/20 text-rose-300' 
                  : submitting 
                    ? 'opacity-70 cursor-not-allowed bg-sky-500' 
                    : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-sky-500/20 hover:shadow-sky-500/30'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري إرسال البيانات...</span>
                </>
              ) : isFuelBalanceNegative ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  <span>ممنوع الحفظ: رصيد وقود سالب</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>حفظ وإرسال التقرير اليومي</span>
                </>
              )}
            </button>
          </div>

        </form>
      )}
    </div>
  );
};

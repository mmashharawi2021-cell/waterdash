import React, { useState, useCallback, useEffect } from 'react';
import {
  calculateOperatingHours,
  calculateFuelConsumed,
  calculateRemainingFuel,
  calculateTotalPumpProduction,
  calculateDesaltedWater,
  calculateWasteWater,
  validateWaterBalance,
} from '../utils/reportCalculations';

interface ReportFormProps {
  onSubmit: (reportData: any) => void;
  previousBalance?: number;
  pumpProductionPerHour?: number;
  fuelConsumptionPerHour?: number;
}

export const ReportForm: React.FC<ReportFormProps> = ({
  onSubmit,
  previousBalance = 0,
  pumpProductionPerHour = 0,
  fuelConsumptionPerHour = 0,
}) => {
  // Generator
  const [startTime, setStartTime] = useState<string>('');
  const [stopTime, setStopTime] = useState<string>('');
  const [operatingHours, setOperatingHours] = useState<number>(0);

  // Fuel
  const [fuelAdded, setFuelAdded] = useState<number>(0);
  const [fuelConsumed, setFuelConsumed] = useState<number>(0);
  const [remainingBalance, setRemainingBalance] = useState<number>(previousBalance);

  // Water
  const [totalProduction, setTotalProduction] = useState<number>(0);
  const [wasteWater, setWasteWater] = useState<number>(0);
  const [desaltedWater, setDesaltedWater] = useState<number>(0);

  // Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);

  // Water Tests
  const [ph, setPh] = useState<number>(7);
  const [tds, setTds] = useState<number>(0);
  const [chlorine, setChlorine] = useState<number>(0);

  // ✅ FIX: تحديث الرصيد الأولي عند تغيير previousBalance من المكون الأب
  useEffect(() => {
    setRemainingBalance(previousBalance);
  }, [previousBalance]);

  // حساب ساعات التشغيل تلقائياً
  useEffect(() => {
    if (startTime && stopTime) {
      const hours = calculateOperatingHours(startTime, stopTime);
      setOperatingHours(hours);
    }
  }, [startTime, stopTime]);

  // حساب السولار المستهلك تلقائياً
  useEffect(() => {
    if (operatingHours > 0 && fuelConsumptionPerHour > 0) {
      const consumed = calculateFuelConsumed(operatingHours, fuelConsumptionPerHour);
      setFuelConsumed(consumed);
    } else {
      // ✅ FIX: إعادة تعيين إلى 0 عند عدم وجود قيم
      setFuelConsumed(0);
    }
  }, [operatingHours, fuelConsumptionPerHour]);

  // حساب الرصيد المتبقي تلقائياً
  useEffect(() => {
    const remaining = calculateRemainingFuel(previousBalance, fuelAdded, fuelConsumed);
    setRemainingBalance(remaining);
  }, [fuelAdded, fuelConsumed, previousBalance]);

  // حساب إجمالي إنتاج الغاطس تلقائياً
  useEffect(() => {
    if (operatingHours > 0 && pumpProductionPerHour > 0) {
      const production = calculateTotalPumpProduction(pumpProductionPerHour, operatingHours);
      setTotalProduction(production);
    } else {
      // ✅ FIX: إعادة تعيين إلى 0 عند عدم وجود قيم
      setTotalProduction(0);
    }
  }, [operatingHours, pumpProductionPerHour]);

  // حساب المياه المحلاة تلقائياً
  useEffect(() => {
    if (totalProduction > 0) {
      const desalted = calculateDesaltedWater(totalProduction, wasteWater);
      setDesaltedWater(desalted);
    } else {
      // ✅ FIX: إعادة تعيين إلى 0 عند عدم وجود قيم
      setDesaltedWater(0);
    }
  }, [totalProduction, wasteWater]);

  // التحقق من توازن المياه
  useEffect(() => {
    const isBalanced = validateWaterBalance(totalProduction, desaltedWater, wasteWater);
    if (!isBalanced && totalProduction > 0) {
      console.warn('⚠️ تحذير: عدم توازن المياه - تحقق من البيانات');
    }
  }, [totalProduction, desaltedWater, wasteWater]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const reportData = {
      date: new Date().toISOString().split('T')[0],
      generator: {
        startTime,
        stopTime,
        operatingHours,
      },
      fuel: {
        previousBalance,
        fuelAdded,
        fuelConsumptionPerHour,
        fuelConsumed,
        remainingBalance,
      },
      water: {
        totalProduction,
        desaltedWater,
        wasteWater,
      },
      beneficiaries,
      waterTests: {
        ph,
        tds,
        chlorine,
      },
    };

    onSubmit(reportData);
  };

  return (
    <form onSubmit={handleSubmit} className="report-form">
      <div className="form-section">
        <h3>🔧 بيانات المولد</h3>

        <div className="form-group">
          <label>وقت بداية التشغيل</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>وقت الإيقاف</label>
          <input
            type="time"
            value={stopTime}
            onChange={(e) => setStopTime(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>عدد ساعات التشغيل (محسوب تلقائياً)</label>
          <input
            type="number"
            value={operatingHours}
            readOnly
            disabled
            className="auto-calculated"
          />
          <span className="hint">يُحسب تلقائياً من وقت البداية والإيقاف</span>
        </div>
      </div>

      <div className="form-section">
        <h3>⛽ بيانات السولار</h3>

        <div className="form-group">
          <label>الرصيد السابق (لتر)</label>
          <input
            type="number"
            value={previousBalance}
            readOnly
            disabled
            className="auto-calculated"
          />
        </div>

        <div className="form-group">
          <label>السولار المضاف اليوم (لتر)</label>
          <input
            type="number"
            value={fuelAdded}
            onChange={(e) => setFuelAdded(Number(e.target.value))}
            min="0"
            step="0.01"
          />
        </div>

        <div className="form-group">
          <label>استهلاك السولار في الساعة (لتر/ساعة)</label>
          <input
            type="number"
            value={fuelConsumptionPerHour}
            readOnly
            disabled
            className="auto-calculated"
          />
        </div>

        <div className="form-group">
          <label>السولار المستهلك (لتر) - محسوب تلقائياً</label>
          <input
            type="number"
            value={fuelConsumed}
            readOnly
            disabled
            className="auto-calculated"
          />
          <span className="hint">
            {operatingHours} ساعة × {fuelConsumptionPerHour} لتر/ساعة = {fuelConsumed} لتر
          </span>
        </div>

        <div className="form-group">
          <label>الرصيد المتبقي (لتر) - محسوب تلقائياً</label>
          <input
            type="number"
            value={remainingBalance}
            readOnly
            disabled
            className="auto-calculated"
          />
          <span className="hint">
            {previousBalance} + {fuelAdded} - {fuelConsumed} = {remainingBalance}
          </span>
        </div>
      </div>

      <div className="form-section">
        <h3>💧 بيانات المياه</h3>

        <div className="form-group">
          <label>إجمالي إنتاج الغاطس (كوب) - محسوب تلقائياً</label>
          <input
            type="number"
            value={totalProduction}
            readOnly
            disabled
            className="auto-calculated"
          />
          <span className="hint">
            {operatingHours} ساعة × {pumpProductionPerHour} كوب/ساعة = {totalProduction} كوب
          </span>
        </div>

        <div className="form-group">
          <label>كمية المياه العادمة (كوب)</label>
          <input
            type="number"
            value={wasteWater}
            onChange={(e) => setWasteWater(Number(e.target.value))}
            min="0"
            step="0.01"
          />
        </div>

        <div className="form-group">
          <label>كمية المياه المحلاة (كوب) - محسوب تلقائياً</label>
          <input
            type="number"
            value={desaltedWater}
            readOnly
            disabled
            className="auto-calculated"
          />
          <span className="hint">
            {totalProduction} - {wasteWater} = {desaltedWater} كوب
          </span>
        </div>
      </div>

      <div className="form-section">
        <h3>🧪 فحوصات جودة المياه</h3>

        <div className="form-group">
          <label>PH</label>
          <input
            type="number"
            value={ph}
            onChange={(e) => setPh(Number(e.target.value))}
            min="0"
            max="14"
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label>TDS (ملغ/لتر)</label>
          <input
            type="number"
            value={tds}
            onChange={(e) => setTds(Number(e.target.value))}
            min="0"
            step="1"
          />
        </div>

        <div className="form-group">
          <label>الكلور الحر (ملغ/لتر)</label>
          <input
            type="number"
            value={chlorine}
            onChange={(e) => setChlorine(Number(e.target.value))}
            min="0"
            step="0.1"
          />
        </div>
      </div>

      <button type="submit" className="btn-submit">
        حفظ التقرير
      </button>
    </form>
  );
};

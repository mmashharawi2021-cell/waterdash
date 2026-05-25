import React, { useEffect, useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  ReferenceLine
} from 'recharts';
import { TrendingUp, Flame, Droplet, Calendar, RefreshCw, AlertCircle, Sparkles, Clock } from 'lucide-react';
import { fetchMonthReports } from '../utils/firebase';
import type { DailyReport } from '../types/Report';

interface AnalyticsDashboardProps {
  onBack?: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onBack }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // e.g. "2026-05"
  );
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load monthly reports
  useEffect(() => {
    async function loadMonthlyData() {
      setLoading(true);
      try {
        const fetched = await fetchMonthReports(selectedMonth);
        setReports(fetched);
      } catch (err) {
        console.error("Failed to load monthly analytics", err);
      } finally {
        setLoading(false);
      }
    }
    loadMonthlyData();
  }, [selectedMonth]);

  // Compute Fuel Efficiency trends (Line Chart)
  // Rate = consumedFuel / operatingHours (Liters per hour)
  const fuelTrendData = React.useMemo(() => {
    // Sort chronologically (oldest to newest)
    const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map(r => {
      const fuelConsumed = Number(r.fuel.consumedFuel || 0);
      const hours = Number(r.generator.operatingHours || 0);
      const rate = hours > 0 ? parseFloat((fuelConsumed / hours).toFixed(2)) : 0;
      
      // Formatted date label for charts (e.g. 25/05)
      const dateParts = r.date.split('-');
      const chartLabel = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : r.date;
      
      return {
        date: r.date,
        label: chartLabel,
        rate: rate,
        fuelConsumed: fuelConsumed,
        hours: hours
      };
    });
  }, [reports]);

  // Compute Water volumes ratio (Pie Data)
  const waterRatioData = React.useMemo(() => {
    let totalProduction = 0;
    let totalWaste = 0;
    
    reports.forEach(r => {
      totalProduction += Number(r.waterQuantities.dailyProduction || 0);
      totalWaste += Number(r.waterQuantities.wasteWater || 0);
    });

    return [
      { name: 'مياه صالحة للشرب (Recovery)', value: parseFloat(totalProduction.toFixed(1)), color: '#10b981' }, // emerald-500
      { name: 'مياه عادمة (Waste Water)', value: parseFloat(totalWaste.toFixed(1)), color: '#ef4444' }    // rose-500
    ];
  }, [reports]);

  // General KPIs summary
  const kpiSummary = React.useMemo(() => {
    let totalHours = 0;
    let totalWaterIn = 0;
    let totalWaterOut = 0;
    let totalFuel = 0;

    reports.forEach(r => {
      totalHours += Number(r.generator.operatingHours || 0);
      totalWaterIn += Number(r.waterQuantities.totalWaterIn || 0);
      totalWaterOut += Number(r.waterQuantities.dailyProduction || 0);
      totalFuel += Number(r.fuel.consumedFuel || 0);
    });

    const avgFuelRate = totalHours > 0 ? parseFloat((totalFuel / totalHours).toFixed(2)) : 0;
    const avgRecovery = totalWaterIn > 0 ? parseFloat(((totalWaterOut / totalWaterIn) * 100).toFixed(1)) : 0;

    return {
      totalHours: parseFloat(totalHours.toFixed(1)),
      totalWaterOut: parseFloat(totalWaterOut.toFixed(1)),
      totalFuel: parseFloat(totalFuel.toFixed(1)),
      avgFuelRate,
      avgRecovery
    };
  }, [reports]);

  return (
    <div className="relative min-h-[90vh] flex flex-col p-6 text-right font-sans" dir="rtl">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans">لوحة تحليلات وإحصاءات الأداء</h1>
            <p className="text-sm text-gray-400 mt-1">تتبع كفاءة استهلاك السولار وتوازن إنتاج المياه وتدقيق الهدر</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl shrink-0">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none font-bold text-sm tracking-wide cursor-pointer"
            />
          </div>

          {onBack && (
            <button 
              onClick={onBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:border-indigo-500/30 bg-white/5 hover:bg-indigo-500/5 text-gray-300 hover:text-indigo-400 font-bold transition-all duration-300"
            >
              <span>العودة</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-32 bg-[#0f1424]/30 border border-white/5 backdrop-blur-md rounded-3xl">
          <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
          <span className="text-gray-400 font-medium">جاري معالجة البيانات وبناء الرسوم البيانية...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-32 bg-[#0f1424]/30 border border-white/5 backdrop-blur-md rounded-3xl">
          <AlertCircle className="w-14 h-14 text-indigo-400" />
          <span className="text-gray-300 font-bold text-lg">لا توجد بيانات تشغيل مسجلة في هذا الشهر</span>
          <p className="text-sm text-gray-500 -mt-2">اختر شهراً آخر أو قم بإضافة تقرير تشغيل لتحديث البيانات.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Row 1: Quick Premium KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl flex justify-between items-center shadow-lg hover:border-indigo-500/20 transition-all duration-500">
              <div>
                <span className="text-xs font-semibold text-gray-400">إجمالي ساعات التشغيل</span>
                <strong className="block text-2xl font-black text-white mt-1.5">{kpiSummary.totalHours} ساعة</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl flex justify-between items-center shadow-lg hover:border-emerald-500/20 transition-all duration-500">
              <div>
                <span className="text-xs font-semibold text-gray-400">إجمالي إنتاج المياه المحلاة</span>
                <strong className="block text-2xl font-black text-emerald-400 mt-1.5">{kpiSummary.totalWaterOut} كوب</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Droplet className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl flex justify-between items-center shadow-lg hover:border-amber-500/20 transition-all duration-500">
              <div>
                <span className="text-xs font-semibold text-gray-400">إجمالي السولار المستهلك</span>
                <strong className="block text-2xl font-black text-amber-400 mt-1.5">{kpiSummary.totalFuel} لتر</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Flame className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl flex justify-between items-center shadow-lg hover:border-pink-500/20 transition-all duration-500">
              <div>
                <span className="text-xs font-semibold text-gray-400">متوسط معدل الاسترجاع</span>
                <strong className="block text-2xl font-black text-pink-400 mt-1.5">{kpiSummary.avgRecovery}%</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* Row 2: Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Chart 1: Fuel Line Chart (Takes 2 Columns) */}
            <div className="lg:col-span-2 bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-xl flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>تتبع معدل استهلاك السولار الساعي (لتر/ساعة)</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  مؤشر الكفاءة: يراقب معدل استهلاك الوقود لكل ساعة تشغيل لكشف حالات تسرب الوقود أو التعديات أو انخفاض كفاءة المولد.
                </p>
              </div>

              <div className="w-full h-80 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fuelTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="label" 
                      stroke="#9ca3af" 
                      fontSize={10} 
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#9ca3af" 
                      fontSize={10} 
                      tickLine={false}
                      unit=" لتر"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(15, 23, 42, 0.9)', 
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        textAlign: 'right',
                        color: '#fff'
                      }}
                      itemStyle={{ color: '#fbbf24' }}
                      labelStyle={{ fontWeight: 'bold', color: '#9ca3af' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    
                    {/* Efficiency Threshold Indicator Reference Line (e.g. 12 Liters/hour is bad) */}
                    <ReferenceLine y={12} label={{ value: 'حد الهدر المرتفع', fill: '#ef4444', fontSize: 10, position: 'top' }} stroke="#ef4444" strokeDasharray="3 3" />
                    
                    <Line 
                      type="monotone" 
                      dataKey="rate" 
                      name="معدل الاستهلاك (لتر/ساعة)" 
                      stroke="#fbbf24" 
                      strokeWidth={3} 
                      activeDot={{ r: 8 }}
                      dot={{ stroke: '#fbbf24', strokeWidth: 1, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Water Balance Pie Chart (Takes 1 Column) */}
            <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-xl flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-emerald-400" />
                  <span>توزيع كميات المياه واستردادها</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  نسبة المياه الصالحة للشرب المنتجة (Recovery) مقارنة بالمياه العادمة الزائدة (Waste).
                </p>
              </div>

              <div className="w-full h-64 mt-4 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={waterRatioData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {waterRatioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(15, 23, 42, 0.9)', 
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        textAlign: 'right',
                        color: '#fff'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Labels Legend */}
              <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                {waterRatioData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-300 font-medium">{item.name}</span>
                    </div>
                    <strong className="text-white">{item.value} كوب</strong>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};

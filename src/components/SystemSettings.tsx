import React, { useEffect, useState } from 'react';
import { Settings, Save, Droplets, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchSystemSettings, saveSystemSettings } from '../utils/firebase';
import type { SystemSettings as ISystemSettings } from '../types/Report';
import { useAuth } from '../context/AuthContext';

interface SystemSettingsProps {
  onBack?: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ onBack }) => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-[#0f1424]/40 border border-white/5 backdrop-blur-md rounded-3xl font-sans" dir="rtl">
        <AlertCircle className="w-16 h-16 text-rose-400 mb-4 animate-pulse" />
        <h2 className="text-xl font-extrabold text-white">صلاحيات غير كافية (Restricted Access)</h2>
        <p className="text-sm text-gray-400 mt-2">عذراً، هذه الصفحة مخصصة لمدير النظام (Admin) فقط ولا يمكنك تعديل إعدادات الثوابت.</p>
        {onBack && (
          <button 
            onClick={onBack} 
            className="mt-6 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-all duration-300"
          >
            العودة للرئيسية
          </button>
        )}
      </div>
    );
  }

  const [settings, setSettings] = useState<ISystemSettings>({
    submersibleProductionPerHour: 55,
    filteredProductionPerHour: 33,
    defaultStationName: 'المحطة الرئيسية',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const fetched = await fetchSystemSettings();
        setSettings(fetched);
      } catch (err) {
        showToast('حدث خطأ أثناء تحميل الإعدادات. تم استخدام القيم الافتراضية.', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleInputChange = (field: keyof ISystemSettings, value: string | number) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (settings.submersibleProductionPerHour <= 0 || isNaN(settings.submersibleProductionPerHour)) {
      showToast('يجب أن تكون إنتاجية الغاطس قيمة موجبة أكبر من صفر', 'error');
      return;
    }
    if (settings.filteredProductionPerHour <= 0 || isNaN(settings.filteredProductionPerHour)) {
      showToast('يجب أن تكون إنتاجية الفلترة قيمة موجبة أكبر من صفر', 'error');
      return;
    }
    if (!settings.defaultStationName.trim()) {
      showToast('الرجاء إدخال اسم المحطة الافتراضي', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveSystemSettings(settings);
      showToast('تم حفظ الإعدادات بنجاح في قاعدة البيانات', 'success');
    } catch (err) {
      showToast('فشل حفظ الإعدادات في قاعدة البيانات.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-[80vh] flex flex-col p-6 text-right font-sans" dir="rtl">
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
            <Settings className="w-6 h-6 text-white animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">إعدادات النظام الثابتة</h1>
            <p className="text-sm text-gray-400 mt-1">إدارة الثوابت ومعدلات الإنتاج المستخدمة في التقارير اليومية</p>
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

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 bg-[#0f1424]/30 border border-white/5 backdrop-blur-md rounded-3xl">
          <RefreshCw className="w-10 h-10 text-sky-400 animate-spin" />
          <span className="text-gray-400 font-medium">جاري تحميل إعدادات النظام من Firebase...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Production Constants Card */}
          <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-8 rounded-3xl shadow-2xl flex flex-col gap-6 hover:border-sky-500/20 transition-all duration-500 group">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <Droplets className="w-5 h-5 text-sky-400 group-hover:animate-bounce" />
              <h3 className="text-lg font-bold text-white">ثوابت الإنتاج والمياه</h3>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-400">إنتاجية الغاطس في الساعة (كوب/ساعة)</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.submersibleProductionPerHour || ''}
                  onChange={(e) => handleInputChange('submersibleProductionPerHour', parseFloat(e.target.value))}
                  placeholder="مثال: 55"
                  className="w-full bg-[#161b30]/60 border border-white/10 rounded-2xl py-3.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 font-bold transition-all"
                  required
                  min="0.1"
                  step="0.01"
                />
              </div>
              <span className="text-xs text-gray-500">تستخدم لحساب إجمالي المياه الداخلة بناءً على ساعات تشغيل المولد.</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-400">الإنتاج المحلى بعد الفلترة في الساعة (كوب/ساعة)</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.filteredProductionPerHour || ''}
                  onChange={(e) => handleInputChange('filteredProductionPerHour', parseFloat(e.target.value))}
                  placeholder="مثال: 33"
                  className="w-full bg-[#161b30]/60 border border-white/10 rounded-2xl py-3.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 font-bold transition-all"
                  required
                  min="0.1"
                  step="0.01"
                />
              </div>
              <span className="text-xs text-gray-500">تستخدم لحساب كمية الإنتاج اليومي الصالح للشرب.</span>
            </div>
          </div>

          {/* General Station Config Card */}
          <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-8 rounded-3xl shadow-2xl flex flex-col gap-6 hover:border-purple-500/20 transition-all duration-500 group">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <Settings className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">إعدادات الموقع والمعلومات العامة</h3>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-400">اسم المحطة الافتراضي</label>
              <input
                type="text"
                value={settings.defaultStationName}
                onChange={(e) => handleInputChange('defaultStationName', e.target.value)}
                placeholder="مثال: المحطة الرئيسية"
                className="w-full bg-[#161b30]/60 border border-white/10 rounded-2xl py-3.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 font-medium transition-all"
                required
              />
              <span className="text-xs text-gray-500">يتم ملء هذا الحقل تلقائياً عند إنشاء تقرير تشغيل يومي جديد.</span>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <p className="text-xs text-gray-400 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5">
                💡 **ملاحظة:** القيم المدخلة في هذه الصفحة يتم حفظها على مستوى السحابة في قاعدة بيانات Firebase. أي تقرير جديد يتم إنشاؤه بعد تعديل هذه الثوابت سيستخدم القيم المحدثة تلقائياً لإجراء الحسابات الرياضية الدقيقة للضخ والإنتاج والوقود.
              </p>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="md:col-span-2 flex justify-end gap-4 mt-4 bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl">
            <button
              type="submit"
              disabled={saving}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 ${
                saving ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>حفظ جميع التغييرات</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

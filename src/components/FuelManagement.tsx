import React, { useEffect, useState } from 'react';
import { 
  Flame, 
  Calendar, 
  Plus, 
  Trash2, 
  ArrowRight,
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  TrendingUp,
  FileText
} from 'lucide-react';
import { fetchFuelEntries, saveFuelEntry, deleteFuelEntry } from '../utils/firebase';
import type { FuelEntry } from '../types/Report';
import { useAuth } from '../context/AuthContext';

interface FuelManagementProps {
  onBack?: () => void;
}

export const FuelManagement: React.FC<FuelManagementProps> = ({ onBack }) => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form states
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<string>('');
  const [source, setSource] = useState<'municipality' | 'purchased' | 'other'>('municipality');
  const [notes, setNotes] = useState<string>('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await fetchFuelEntries();
      setEntries(data);
    } catch (err) {
      console.error(err);
      showToast('فشل في تحميل سجلات السولار', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      showToast('الرجاء إدخال كمية صحيحة أكبر من صفر', 'error');
      return;
    }
    if (!date) {
      showToast('الرجاء اختيار التاريخ', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveFuelEntry({
        date,
        quantity: parsedQty,
        source,
        notes: notes.trim()
      });
      showToast('🎉 تم تسجيل كمية السولار المضافة بنجاح!', 'success');
      setQuantity('');
      setNotes('');
      loadEntries();
    } catch (err) {
      showToast('فشل حفظ السجل في قاعدة البيانات', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    setDeletingId(id);
    try {
      await deleteFuelEntry(id);
      showToast('تم حذف السجل بنجاح', 'success');
      loadEntries();
    } catch (err) {
      showToast('فشل في حذف السجل من قاعدة البيانات', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const getSourceBadge = (src: 'municipality' | 'purchased' | 'other') => {
    switch (src) {
      case 'municipality':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 border border-sky-500/20 text-sky-400">
            مورد من البلدية
          </span>
        );
      case 'purchased':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
            شراء خاص
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400">
            أخرى / تبرع
          </span>
        );
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">إدارة وتوريد وقود السولار</h1>
            <p className="text-sm text-gray-400 mt-1">تسجيل وتتبع الشحنات والكميات المضافة لخزانات المولدات يومياً</p>
          </div>
        </div>
        
        {onBack && (
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:border-amber-500/30 bg-white/5 hover:bg-amber-500/5 text-gray-300 hover:text-amber-400 font-bold transition-all duration-300"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Col 1: Add Fuel Entry Form */}
        <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl flex flex-col gap-6 hover:border-amber-500/10 transition-all duration-500 group">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <Plus className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-white">تسجيل شحنة / وارد جديد</h3>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            {/* Date field */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>تاريخ التوريد (Date)</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-[#161b30]/60 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-bold transition-all"
                required
              />
            </div>

            {/* Quantity field */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>الكمية المضافة (لتر)</span>
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="أدخل عدد اللترات المضافة..."
                className="bg-[#161b30]/60 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-bold transition-all"
                min="0.1"
                step="0.1"
                required
              />
            </div>

            {/* Source dropdown */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                <span>مصدر توريد السولار</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="bg-[#161b30]/60 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-bold transition-all appearance-none cursor-pointer"
              >
                <option value="municipality">مورد من البلدية (Municipal Supply)</option>
                <option value="purchased">شراء خاص (Purchased)</option>
                <option value="other">أخرى / تبرع (Other)</option>
              </select>
            </div>

            {/* Notes field */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-semibold">ملاحظات إضافية (جهة التوريد، رقم السند، إلخ)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تفاصيل التوريد..."
                rows={3}
                className="bg-[#161b30]/60 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-medium transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري التسجيل...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>تسجيل وارد السولار</span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* Col 2: Recent Fuel Entries List */}
        <div className="lg:col-span-2 bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-white/5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              <span>جدول توريدات السولار المسجلة</span>
            </h3>
            
            <button 
              onClick={loadEntries}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
              <span className="text-xs text-gray-400">جاري تحميل سجلات السولار...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
              <AlertCircle className="w-12 h-12 text-amber-500/50 animate-pulse" />
              <span className="text-sm text-gray-400 font-medium">لا توجد سجلات لتوريد السولار حالياً</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 font-bold">
                    <th className="py-4 px-4">تاريخ التوريد</th>
                    <th className="py-4 px-4 text-center">الكمية</th>
                    <th className="py-4 px-4 text-center">المصدر</th>
                    <th className="py-4 px-4">ملاحظات</th>
                    {isAdmin && <th className="py-4 px-4 text-left">خيارات</th>}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-all text-gray-300 font-medium">
                      <td className="py-4 px-4 font-bold text-white">{entry.date}</td>
                      <td className="py-4 px-4 text-center font-bold text-amber-400">{entry.quantity} لتر</td>
                      <td className="py-4 px-4 text-center">{getSourceBadge(entry.source)}</td>
                      <td className="py-4 px-4 max-w-[200px] truncate" title={entry.notes}>{entry.notes || '-'}</td>
                      {isAdmin && (
                        <td className="py-4 px-4 text-left">
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deletingId === entry.id}
                            className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                            title="حذف الوارد"
                          >
                            {deletingId === entry.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

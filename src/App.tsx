import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AddNewReport } from './components/AddNewReport';
import { SystemSettings } from './components/SystemSettings';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { fetchAllReports, deleteDailyReport, fetchMonthReports } from './utils/firebase';
import { exportDailyReportPDF, exportMonthlyReportsExcel } from './utils/exportUtils';
import type { DailyReport } from './types/Report';
import { 
  Droplet, 
  Settings, 
  TrendingUp, 
  PlusCircle, 
  LogOut, 
  FileText, 
  Trash2, 
  UserCheck, 
  ShieldAlert, 
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Lock,
  User,
  Loader2,
  RefreshCw,
  Info,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';
import './App.css';

// PWA Prompt Alert Component
const PWAPrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900/90 border border-indigo-500/30 backdrop-blur-xl p-5 rounded-2xl shadow-2xl flex flex-col gap-3 font-sans text-right animate-bounce">
      <div className="flex items-center gap-2">
        <Info className="w-5 h-5 text-indigo-400" />
        <span className="text-white font-bold text-sm">
          {offlineReady ? "التطبيق جاهز للعمل بدون إنترنت (Offline)" : "يتوفر تحديث جديد للنظام!"}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">
        {offlineReady 
          ? "يمكنك الآن تشغيل نظام ضخ المياه وإدخال التقارير اليومية حتى في حالة انقطاع شبكة الاتصال."
          : "يرجى تحديث التطبيق للحصول على آخر ميزات تحليلات الوقود وفحوصات الجودة."}
      </p>
      <div className="flex gap-2 justify-end mt-1 text-xs">
        {needRefresh && (
          <button 
            onClick={() => updateServiceWorker(true)}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-extrabold transition-all"
          >
            تحديث الآن
          </button>
        )}
        <button 
          onClick={close}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-all"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
};

// Login Screen Component
const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [role, setRole] = useState<'admin' | 'operator'>('operator');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Small credential checks to map role logically
    if (role === 'admin' && username !== 'صالح الدحنون' && username !== 'admin') {
      setError('اسم المستخدم للمدير غير صحيح (استخدم "صالح الدحنون" أو "admin")');
      setLoading(false);
      return;
    }

    try {
      await login(username, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول للمحطة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0b0f19] relative overflow-hidden font-sans text-right" dir="rtl">
      {/* Background Neon Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <section className="w-full max-w-lg bg-[#0f1424]/40 border border-white/5 backdrop-blur-xl p-8 sm:p-10 rounded-[32px] shadow-2xl relative z-10 flex flex-col gap-8">
        
        {/* Title */}
        <div className="text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 mb-4">
            <Droplet className="w-8 h-8 text-white animate-pulse" />
          </div>
          <span className="text-xs uppercase font-extrabold tracking-widest text-sky-400 bg-sky-500/10 px-3.5 py-1 rounded-full border border-sky-500/20">منصة تشغيل رسمية</span>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-3">نظام تقارير تشغيل وضخ المياه</h1>
          <p className="text-sm text-gray-400 mt-1">تعبئة وإحصاءات المحطة والوقود اليومي للمحاسبين والمشرفين</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl flex items-center gap-3 text-sm font-semibold">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Form Group: Username */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 font-bold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>اسم المستخدم / اسم المشغل</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسمك الكامل المعتمد..."
              className="bg-[#161b30]/60 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 font-medium transition-all"
              required
            />
          </div>

          {/* Form Group: Role Selection Pills */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>صلاحيات تسجيل الدخول للمحطة</span>
            </label>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('operator')}
                className={`py-3.5 rounded-2xl border flex flex-col items-center gap-1.5 font-bold transition-all duration-300 ${
                  role === 'operator' 
                    ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-lg shadow-sky-500/5' 
                    : 'bg-[#161b30]/40 border-white/5 text-gray-400 hover:bg-[#161b30]/70'
                }`}
              >
                <UserCheck className="w-5 h-5" />
                <span className="text-xs">مُدخل/مشغل (Operator)</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-3.5 rounded-2xl border flex flex-col items-center gap-1.5 font-bold transition-all duration-300 ${
                  role === 'admin' 
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/5' 
                    : 'bg-[#161b30]/40 border-white/5 text-gray-400 hover:bg-[#161b30]/70'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="text-xs">مدير النظام (Admin)</span>
              </button>
            </div>
            {role === 'admin' && (
              <span className="text-[10px] text-indigo-400 mt-1">💡 لتسجيل دخول كمسؤول، يرجى كتابة "صالح الدحنون" أو "admin" كاسم مستخدم.</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold shadow-lg shadow-sky-500/20 hover:shadow-lg hover:shadow-sky-400/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>دخول للنظام الآمن</span>
            )}
          </button>
        </form>
      </section>
    </main>
  );
};

// Main Workspace Inner Controller (RBAC Routing)
const DashboardInner: React.FC = () => {
  const { currentUser, logout, isAdmin, isOperator } = useAuth();
  const [screen, setScreen] = useState<'dashboard' | 'addReport' | 'analytics' | 'settings'>('dashboard');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Month for financial spreadsheet aggregation
  const [exportMonth, setExportMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  // Load list of reports (Admins only view lists)
  const refreshReportsList = async () => {
    if (!isAdmin) return;
    setLoadingReports(true);
    try {
      const fetched = await fetchAllReports();
      setReports(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (isAdmin && screen === 'dashboard') {
      refreshReportsList();
    }
  }, [isAdmin, screen]);

  // Close sidebar when screen changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [screen]);

  // Secure Delete daily report
  const handleDelete = async (id?: string) => {
    if (!id || !window.confirm("هل أنت متأكد من حذف هذا التقرير نهائياً من قاعدة البيانات؟ لا يمكن التراجع!")) return;
    try {
      await deleteDailyReport(id);
      refreshReportsList();
    } catch (err) {
      alert("فشل الحذف بسبب قيود الأمان أو الشبكة");
    }
  };

  // Compile Monthly Excel Spreadsheet
  const handleExcelExport = async () => {
    setExportingExcel(true);
    try {
      const monthData = await fetchMonthReports(exportMonth);
      if (monthData.length === 0) {
        alert(`لا توجد تقارير تشغيل مسجلة لشهر ${exportMonth} لتصديرها.`);
        return;
      }
      exportMonthlyReportsExcel(monthData, exportMonth);
    } catch (err) {
      alert("فشل تصدير جدول الإكسل المالي للمحاسبين");
    } finally {
      setExportingExcel(false);
    }
  };

  // 1. Restricted Operator Interface
  if (isOperator) {
    return (
      <div className="builder-app font-sans" dir="rtl">
        {/* Sidebar Overlay for Mobile */}
        {sidebarOpen && (
          <div 
            className="sidebar-overlay active"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`builder-sidebar ${sidebarOpen ? 'active' : ''} flex flex-col justify-between`}>
          <div className="flex flex-col gap-6">
            <div className="brand-panel">
              <span className="logo">💧 WaterDash</span>
              <p className="text-xs text-sky-400 font-bold mt-1 bg-sky-500/10 py-1.5 px-3 rounded-xl border border-sky-500/20 text-center">بوابة المُدخل والمشغل</p>
            </div>
            
            <section className="panel flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <User className="w-5 h-5 text-sky-400" />
                <span className="text-white font-bold text-sm">الملف الشخصي للمشغل</span>
              </div>
              <div className="text-xs text-gray-400 leading-relaxed">
                <p><strong>الاسم:</strong> {currentUser?.username}</p>
                <p className="mt-1"><strong>الدور:</strong> مشغل المحطة اليومي</p>
              </div>
            </section>

            <section className="panel flex flex-col gap-2">
              <h3 className="text-xs text-gray-400 font-bold uppercase">المهام المتاحة</h3>
              <button 
                className="w-full text-right py-3 px-4 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold flex items-center gap-2"
                disabled
              >
                <PlusCircle className="w-4.5 h-4.5" />
                <span>تعبئة تقرير تشغيل اليوم</span>
              </button>
            </section>
          </div>

          <button 
            onClick={logout}
            className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 text-gray-300 hover:text-rose-400 font-bold flex items-center justify-center gap-2 transition-all duration-300"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج الآمن</span>
          </button>
        </aside>

        {/* Mobile Sidebar Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="sidebar-toggle-btn show"
          title="فتح القائمة الجانبية"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        <main className="builder-main">
          {/* Locked to AddNewReport */}
          <AddNewReport onSuccess={() => alert("تم إرسال تقرير الوردية بنجاح!")} />
        </main>
      </div>
    );
  }

  // 2. Full Admin Dashboard Panel
  return (
    <div className="builder-app font-sans" dir="rtl">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay active"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`builder-sidebar ${sidebarOpen ? 'active' : ''} flex flex-col justify-between`}>
        <div className="flex flex-col gap-6">
          <div className="brand-panel">
            <span className="logo">💧 WaterDash</span>
            <p className="text-xs text-indigo-400 font-bold mt-1 bg-indigo-500/10 py-1.5 px-3 rounded-xl border border-indigo-500/20 text-center">لوحة تحكم المسؤول (Admin)</p>
          </div>

          <section className="panel flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <User className="w-5 h-5 text-indigo-400" />
              <span className="text-white font-bold text-sm">مسؤول النظام</span>
            </div>
            <div className="text-xs text-gray-400">
              <p><strong>المستخدم:</strong> {currentUser?.username}</p>
              <p className="mt-1"><strong>الدور:</strong> سوبر أدمن / مشرف</p>
            </div>
          </section>

          {/* Nav Items */}
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setScreen('dashboard')}
              className={`w-full text-right py-3 px-4 rounded-xl border font-bold flex items-center gap-2 transition-all duration-200 ${
                screen === 'dashboard'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-black'
                  : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Layers className="w-4.5 h-4.5" />
              <span>الرئيسية وجدول التقارير</span>
            </button>

            <button
              onClick={() => setScreen('addReport')}
              className={`w-full text-right py-3 px-4 rounded-xl border font-bold flex items-center gap-2 transition-all duration-200 ${
                screen === 'addReport'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-black'
                  : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4.5 h-4.5" />
              <span>إضافة تقرير تشغيل</span>
            </button>

            <button
              onClick={() => setScreen('analytics')}
              className={`w-full text-right py-3 px-4 rounded-xl border font-bold flex items-center gap-2 transition-all duration-200 ${
                screen === 'analytics'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-black'
                  : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4.5 h-4.5" />
              <span>تحليلات الأداء والرسوم</span>
            </button>

            <button
              onClick={() => setScreen('settings')}
              className={`w-full text-right py-3 px-4 rounded-xl border font-bold flex items-center gap-2 transition-all duration-200 ${
                screen === 'settings'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-black'
                  : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
              <span>إعدادات النظام الثابتة</span>
            </button>
          </nav>
        </div>

        <button 
          onClick={logout}
          className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 text-gray-300 hover:text-rose-400 font-bold flex items-center justify-center gap-2 transition-all duration-300"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </aside>

      {/* Mobile Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="sidebar-toggle-btn show"
        title="فتح القائمة الجانبية"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Main Workspace content */}
      <main className="builder-main flex-1 overflow-y-auto">
        
        {screen === 'addReport' && (
          <AddNewReport onBack={() => setScreen('dashboard')} onSuccess={() => setScreen('dashboard')} />
        )}

        {screen === 'settings' && (
          <SystemSettings onBack={() => setScreen('dashboard')} />
        )}

        {screen === 'analytics' && (
          <AnalyticsDashboard onBack={() => setScreen('dashboard')} />
        )}

        {screen === 'dashboard' && (
          <div className="flex flex-col gap-8 text-right">
            
            {/* Dashboard Title & Quick Excel Panel */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-xl">
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">نظام تقارير محطات الضخ</h1>
                <p className="text-sm text-gray-400 mt-1">تصدير الدفاتر المالية وسجلات الوردية وإدارة التراخيص</p>
              </div>

              {/* Excel Aggregate Panel */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-3 rounded-2xl self-stretch sm:self-auto hover:border-white/15 transition-all">
                <div className="flex items-center gap-2 shrink-0">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <input
                    type="month"
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="bg-transparent border-none text-white text-xs font-bold focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="w-[1px] h-6 bg-white/10" />
                <button
                  onClick={handleExcelExport}
                  disabled={exportingExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white text-xs font-extrabold transition-all disabled:opacity-50"
                >
                  {exportingExcel ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>تصدير إكسل المحاسبين (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* List Table Card */}
            <div className="bg-[#0f1424]/40 border border-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span>سجلات التقارير اليومية المسجلة</span>
                </h3>
                
                <button 
                  onClick={refreshReportsList}
                  disabled={loadingReports}
                  className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingReports ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingReports ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span className="text-xs text-gray-400">جاري تحميل السجلات من السحابة...</span>
                </div>
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                  <AlertCircle className="w-12 h-12 text-indigo-400/50" />
                  <span className="text-sm text-gray-400 font-medium">لا توجد سجلات ضخ محفوظة حتى الآن</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-400 font-bold">
                        <th className="py-4 px-4">التاريخ (Date)</th>
                        <th className="py-4 px-4">اسم المحطة</th>
                        <th className="py-4 px-4 text-center">ساعات التشغيل</th>
                        <th className="py-4 px-4 text-center">الوقود المتبقي</th>
                        <th className="py-4 px-4 text-center">إنتاج المياه الصالحة</th>
                        <th className="py-4 px-4 text-center">نسبة الاسترجاع</th>
                        <th className="py-4 px-4 text-left">خيارات المستندات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => (
                        <tr key={report.id} className="border-b border-white/5 hover:bg-white/5 transition-all text-gray-300 font-medium">
                          <td className="py-4 px-4 font-bold text-white">{report.date}</td>
                          <td className="py-4 px-4">{report.stationName}</td>
                          <td className="py-4 px-4 text-center font-bold text-sky-400">{report.generator.formattedOperatingHours}</td>
                          <td className="py-4 px-4 text-center">{report.fuel.currentBalance} لتر</td>
                          <td className="py-4 px-4 text-center text-emerald-400 font-bold">{report.waterQuantities.dailyProduction} كوب</td>
                          <td className="py-4 px-4 text-center">%{report.waterQuantities.recoveryRate}</td>
                          <td className="py-4 px-4 text-left flex justify-end gap-2 items-center">
                            <button
                              onClick={() => exportDailyReportPDF(report)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white text-xs font-extrabold transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>طباعة PDF</span>
                            </button>
                            
                            <button
                              onClick={() => handleDelete(report.id)}
                              className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                              title="حذف السجل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>

          </div>
        )}

      </main>
    </div>
  );
};

// Root Router shell linking providers
function App() {
  return (
    <AuthProvider>
      <div className="relative min-h-screen text-right">
        {/* Render Workspace Inside Context */}
        <AppContent />

        {/* Global PWA update prompts */}
        <PWAPrompt />
      </div>
    </AuthProvider>
  );
}

// Controller handling authentication check
const AppContent: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center gap-4 text-center font-sans">
        <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin" />
        <span className="text-gray-400 font-bold text-sm tracking-wide">جاري فحص صلاحيات وتأمين الاتصال...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return <DashboardInner />;
};

export default App;

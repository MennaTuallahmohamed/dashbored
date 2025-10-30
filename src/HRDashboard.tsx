import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  Firestore,
  type DocumentData,
} from "firebase/firestore";
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  Mail,
  Phone,
  FileText,
  CheckCircle,
  XCircle,
  Search,
  Download,
  Bell,
  Send,
  BarChart3,
  PieChart,
  Activity,
} from "lucide-react";

/** ---------- Firebase config (تأكدي من بياناتك) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAoP0u6uyNFmTqrYOHz7o-FY82hz-dtW-I",
  authDomain: "ahmed-effd6.firebaseapp.com",
  projectId: "ahmed-effd6",
  storageBucket: "ahmed-effd6.firebasestorage.app",
  messagingSenderId: "1059277448571",
  appId: "1:1059277448571:web:1da4d37f3fb4c79de789de",
  measurementId: "G-WQDDPJ0ZCX",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/** ---------- Types ---------- */
type Status = "new" | "pending" | "approved" | "rejected" | string;

interface BaseItem {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  timestamp?: string; // human readable timestamp (we convert)
  rawTimestamp?: any; // original firebase timestamp or string
  status?: Status;
  type: "contact" | "appointment";
  [key: string]: any;
}

/** ---------- Component ---------- */
const HRDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [contacts, setContacts] = useState<BaseItem[]>([]);
  const [appointments, setAppointments] = useState<BaseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedItem, setSelectedItem] = useState<BaseItem | null>(null);
  const [emailModal, setEmailModal] = useState<boolean>(false);
  const [emailContent, setEmailContent] = useState<string>("");
  const [analytics, setAnalytics] = useState<{
    daily: Record<string, number>;
    monthly: Record<string, number>;
    weekly: Record<string, number>;
  }>({ daily: {}, monthly: {}, weekly: {} });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ---------- Helpers ---------- */
  const toIsoDateString = (value: any): string => {
    // Firestore Timestamp has toDate() method
    try {
      if (!value) return "";
      if (typeof value === "string") return value;
      if (value.toDate && typeof value.toDate === "function") {
        return value.toDate().toISOString();
      }
      // fallback: numeric timestamp
      if (typeof value.seconds === "number") {
        return new Date(value.seconds * 1000).toISOString();
      }
      if (typeof value === "number") {
        return new Date(value).toISOString();
      }
      // last resort
      return new Date(value).toISOString();
    } catch {
      return "";
    }
  };

  const formatReadable = (isoStr?: string) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(); // you can change locale if needed
    } catch {
      return isoStr;
    }
  };

  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `Week ${weekNo}`;
  };

  /** ---------- Fetch Data ---------- */
  const fetchData = async () => {
    try {
      setLoading(true);

      // contacts
      const contactsRef = collection(db, "contacts");
      const contactsQuery = query(contactsRef, orderBy("timestamp", "desc"));
      const contactsSnap = await getDocs(contactsQuery);

      const contactsData: BaseItem[] = contactsSnap.docs.map((d) => {
        const raw = d.data() as DocumentData;
        const iso = toIsoDateString(raw.timestamp);
        return {
          id: d.id,
          ...raw,
          rawTimestamp: raw.timestamp,
          timestamp: formatReadable(iso),
          type: "contact",
        } as BaseItem;
      });

      // appointments
      const appointmentsRef = collection(db, "appointments");
      const appointmentsQuery = query(appointmentsRef, orderBy("timestamp", "desc"));
      const appointmentsSnap = await getDocs(appointmentsQuery);

      const appointmentsData: BaseItem[] = appointmentsSnap.docs.map((d) => {
        const raw = d.data() as DocumentData;
        const iso = toIsoDateString(raw.timestamp);
        return {
          id: d.id,
          ...raw,
          rawTimestamp: raw.timestamp,
          timestamp: formatReadable(iso),
          type: "appointment",
        } as BaseItem;
      });

      setContacts(contactsData);
      setAppointments(appointmentsData);

      calculateAnalytics([...contactsData, ...appointmentsData]);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setLoading(false);
    }
  };

  /** ---------- Analytics ---------- */
  const calculateAnalytics = (allData: BaseItem[]) => {
    const daily: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    const weekly: Record<string, number> = {};

    allData.forEach((item) => {
      // we use rawTimestamp if available for precise calculation
      const iso = item.rawTimestamp ? toIsoDateString(item.rawTimestamp) : item.timestamp;
      if (!iso) return;
      const d = new Date(iso);
      const dayKey = d.toISOString().split("T")[0];
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const weekKey = getWeekNumber(d);

      daily[dayKey] = (daily[dayKey] || 0) + 1;
      monthly[monthKey] = (monthly[monthKey] || 0) + 1;
      weekly[weekKey] = (weekly[weekKey] || 0) + 1;
    });

    setAnalytics({ daily, monthly, weekly });
  };

  /** ---------- Update status ---------- */
  const updateStatus = async (itemId: string, collectionName: string, newStatus: Status) => {
    try {
      const ref = doc(db, collectionName, itemId);
      await updateDoc(ref, { status: newStatus });
      await fetchData();
      alert(`تم تحديث الحالة إلى: ${newStatus}`);
    } catch (err) {
      console.error("Error updating status:", err);
      alert("حدث خطأ في تحديث الحالة");
    }
  };

  /** ---------- Email ---------- */
  const sendEmail = (item: BaseItem) => {
    setSelectedItem(item);
    setEmailContent(`مرحباً ${item.name || ""},\n\nشكراً لتواصلك معنا...\n\nمع تحياتنا`);
    setEmailModal(true);
  };

  const handleSendEmail = () => {
    if (!selectedItem || !selectedItem.email) {
      alert("لا يوجد بريد إلكتروني للمرسل إليه.");
      return;
    }
    const mailtoLink = `mailto:${selectedItem.email}?subject=${encodeURIComponent(
      "رد على طلبك"
    )}&body=${encodeURIComponent(emailContent)}`;
    window.open(mailtoLink, "_blank");
    setEmailModal(false);
    alert("تم فتح برنامج البريد الإلكتروني");
  };

  /** ---------- Derived data & filters ---------- */
  const allItems = [...contacts, ...appointments];
  const filteredItems = allItems.filter((item) => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !lowerSearch ||
      (item.name && item.name.toLowerCase().includes(lowerSearch)) ||
      (item.email && item.email.toLowerCase().includes(lowerSearch));
    const matchesFilter = filterStatus === "all" || item.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalContacts: contacts.length,
    totalAppointments: appointments.length,
    pendingAppointments: appointments.filter((a) => a.status === "pending").length,
    newContacts: contacts.filter((c) => c.status === "new").length,
  };

  const getStatusColor = (status?: Status) => {
    switch (status) {
      case "new":
        return "bg-blue-500";
      case "pending":
        return "bg-yellow-500";
      case "approved":
        return "bg-green-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify(allItems, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr-data-${new Date().toISOString()}.json`;
    a.click();
  };

  /** ---------- Loading UI ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-xl">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  /** ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              لوحة تحكم الموارد البشرية
            </h1>
            <p className="text-gray-400">مرحباً بك، إليك ملخص شامل لجميع الطلبات والمواعيد مع التحليلات</p>
          </div>

          <div className="flex gap-4 items-center">
            <button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition flex items-center gap-2">
              <Activity className="w-4 h-4" />
              تحديث
            </button>
            <button onClick={exportData} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition flex items-center gap-2">
              <Download className="w-4 h-4" />
              تصدير
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 shadow-2xl transform hover:scale-105 transition">
            <div className="flex justify-between items-start mb-4">
              <Users className="w-12 h-12 text-white opacity-80" />
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{stats.totalContacts}</span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalContacts}</p>
            <p className="text-blue-100">رسائل التواصل</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 shadow-2xl transform hover:scale-105 transition">
            <div className="flex justify-between items-start mb-4">
              <Calendar className="w-12 h-12 text-white opacity-80" />
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{stats.totalAppointments}</span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalAppointments}</p>
            <p className="text-purple-100">حجز المواعيد</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 shadow-2xl transform hover:scale-105 transition">
            <div className="flex justify-between items-start mb-4">
              <Clock className="w-12 h-12 text-white opacity-80" />
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{stats.pendingAppointments}</span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.pendingAppointments}</p>
            <p className="text-orange-100">بانتظار الموافقة</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-6 shadow-2xl transform hover:scale-105 transition">
            <div className="flex justify-between items-start mb-4">
              <Bell className="w-12 h-12 text-white opacity-80" />
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{stats.newContacts}</span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.newContacts}</p>
            <p className="text-emerald-100">طلبات جديدة</p>
          </div>
        </div>

        {/* Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-8 h-8 text-blue-400" />
              <h3 className="text-xl font-bold">تحليل يومي</h3>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.entries(analytics.daily)
                .slice(-7)
                .map(([day, count]) => (
                  <div key={day} className="flex justify-between items-center bg-white/5 p-2 rounded">
                    <span className="text-sm text-gray-300">{day}</span>
                    <span className="font-bold text-blue-400">{count} طلب</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <PieChart className="w-8 h-8 text-purple-400" />
              <h3 className="text-xl font-bold">تحليل شهري</h3>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.entries(analytics.monthly).map(([month, count]) => (
                <div key={month} className="flex justify-between items-center bg-white/5 p-2 rounded">
                  <span className="text-sm text-gray-300">{month}</span>
                  <span className="font-bold text-purple-400">{count} طلب</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <h3 className="text-xl font-bold">تحليل أسبوعي</h3>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.entries(analytics.weekly).map(([week, count]) => (
                <div key={week} className="flex justify-between items-center bg-white/5 p-2 rounded">
                  <span className="text-sm text-gray-300">{week}</span>
                  <span className="font-bold text-green-400">{count} طلب</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="البحث بالاسم أو البريد الإلكتروني..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition backdrop-blur"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-6 py-3 text-white focus:outline-none focus:border-purple-500 transition cursor-pointer backdrop-blur"
          >
            <option value="all">جميع الحالات</option>
            <option value="new">جديد</option>
            <option value="pending">قيد الانتظار</option>
            <option value="approved">موافق عليه</option>
            <option value="rejected">مرفوض</option>
          </select>
        </div>
      </div>

      {/* Content list */}
      <div className="space-y-4">
        {filteredItems.map((item) => (
          <div key={item.id} className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20 hover:border-purple-500 transition shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${getStatusColor(item.status)} flex items-center justify-center shadow-lg`}>
                  {item.type === "contact" ? <Users className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white">{item.name || "—"}</h3>
                  <p className="text-gray-400 text-sm">{item.type === "contact" ? "📧 رسالة تواصل" : "📅 موعد محجوز"}</p>
                </div>
              </div>

              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(item.status)}`}>
                {item.status === "new" && "🆕 جديد"}
                {item.status === "pending" && "⏳ قيد الانتظار"}
                {item.status === "approved" && "✅ موافق عليه"}
                {item.status === "rejected" && "❌ مرفوض"}
                {!item.status && "🆕 جديد"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 bg-white/5 p-3 rounded-lg">
                <Mail className="w-5 h-5 text-purple-400" />
                <span className="text-sm">{item.email || "—"}</span>
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-3 rounded-lg">
                <Phone className="w-5 h-5 text-green-400" />
                <span className="text-sm">{item.phone || "—"}</span>
              </div>
            </div>

            {item.type === "appointment" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-500/20 p-3 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">📅 التاريخ</p>
                  <p className="font-bold">{item.preferredDate || "—"}</p>
                </div>

                <div className="bg-green-500/20 p-3 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">⏰ الوقت</p>
                  <p className="font-bold">{item.preferredTime || "—"}</p>
                </div>

                <div className="bg-purple-500/20 p-3 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">📍 النوع</p>
                  <p className="font-bold">{item.meetingType === "in-person" ? "حضوري" : "عن بعد"}</p>
                </div>
              </div>
            )}

            {item.company && (
              <div className="mb-3 bg-indigo-500/20 p-3 rounded-lg border border-indigo-500/30">
                <p className="text-sm"><span className="font-bold text-indigo-300">🏢 الشركة:</span> {item.company}</p>
              </div>
            )}

            {item.service && (
              <div className="mb-3 bg-cyan-500/20 p-3 rounded-lg border border-cyan-500/30">
                <p className="text-sm"><span className="font-bold text-cyan-300">🛠️ الخدمة:</span> {item.service}</p>
              </div>
            )}

            <div className="mb-4 bg-white/5 p-4 rounded-lg border border-white/10">
              <p className="text-sm text-gray-400 mb-2 font-semibold">💬 الرسالة:</p>
              <p className="text-white leading-relaxed">{item.message || "—"}</p>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-white/10">
              <span className="text-xs text-gray-400">⏱️ {item.timestamp || "—"}</span>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => sendEmail(item)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-lg">
                  <Send className="w-4 h-4" />
                  إرسال رد
                </button>

                <button onClick={() => updateStatus(item.id, item.type === "contact" ? "contacts" : "appointments", "approved")} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-lg">
                  <CheckCircle className="w-4 h-4" />
                  قبول
                </button>

                <button onClick={() => updateStatus(item.id, item.type === "contact" ? "contacts" : "appointments", "rejected")} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-lg">
                  <XCircle className="w-4 h-4" />
                  رفض
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-16 bg-white/5 rounded-xl backdrop-blur border border-white/10">
            <FileText className="w-20 h-20 text-gray-500 mx-auto mb-4 opacity-50" />
            <p className="text-gray-400 text-xl">لا توجد بيانات لعرضها</p>
            <p className="text-gray-500 text-sm mt-2">جرب تغيير معايير البحث أو الفلترة</p>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-2xl w-full border border-purple-500/30 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Mail className="w-6 h-6 text-purple-400" />
                إرسال رد بالبريد الإلكتروني
              </h2>
              <button onClick={() => setEmailModal(false)} className="text-gray-400 hover:text-white transition">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 bg-white/5 p-4 rounded-lg border border-white/10">
              <p className="text-sm text-gray-400">إلى:</p>
              <p className="text-white font-semibold">{selectedItem?.email || "—"}</p>
            </div>

            <textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={8}
              className="w-full bg-white/10 border border-white/20 rounded-lg p-4 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition resize-none"
              placeholder="اكتب رسالتك هنا..."
            />

            <div className="flex gap-3 mt-6">
              <button onClick={handleSendEmail} className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-6 py-3 rounded-lg font-bold transition shadow-lg flex items-center justify-center gap-2">
                <Send className="w-5 h-5" />
                إرسال الرسالة
              </button>

              <button onClick={() => setEmailModal(false)} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRDashboard;

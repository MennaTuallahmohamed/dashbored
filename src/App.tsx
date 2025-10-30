import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

// Firebase config
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

type ItemType = "contact" | "appointment";
type Status = "new" | "pending" | "approved" | "rejected" | undefined;

interface BaseItem {
  id: string;
  type: ItemType;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  service?: string;
  message?: string;
  preferredDate?: string;
  preferredTime?: string;
  meetingType?: string;
  status?: Status;
  timestamp?: string;
  rawTimestamp?: any;
}

function toIso(val: any) {
  try {
    if (!val) return "";
    if (typeof val === "string") return val;
    if ((val as any).toDate) return (val as any).toDate().toISOString();
    if (typeof (val as any).seconds === "number") return new Date((val as any).seconds * 1000).toISOString();
    return new Date(val).toISOString();
  } catch { return ""; }
}
function fmt(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("ar-EG"); } catch { return iso; }
}

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<BaseItem[]>([]);
  const [appointments, setAppointments] = useState<BaseItem[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [detailItem, setDetailItem] = useState<BaseItem | null>(null);
  const [emailItem, setEmailItem] = useState<BaseItem | null>(null);
  const [emailBody, setEmailBody] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: "contact" as ItemType,
    name: "",
    email: "",
    phone: "",
    company: "",
    service: "",
    preferredDate: "",
    preferredTime: "",
    meetingType: "in-person",
    message: "",
  });

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const cs = await getDocs(collection(db, "contacts"));
      const contactsData: BaseItem[] = cs.docs.map((d) => {
        const raw = d.data() as any;
        const iso = toIso(raw.timestamp);
        return { id: d.id, type: "contact", ...raw, rawTimestamp: raw.timestamp, timestamp: fmt(iso) };
      });
      const ap = await getDocs(collection(db, "appointments"));
      const appointmentsData: BaseItem[] = ap.docs.map((d) => {
        const raw = d.data() as any;
        const iso = toIso(raw.timestamp || raw.createdAt);
        return { id: d.id, type: "appointment", ...raw, rawTimestamp: raw.timestamp || raw.createdAt, timestamp: fmt(iso) };
      });
      setContacts(contactsData);
      setAppointments(appointmentsData);
    } finally { setLoading(false); }
  }

  const all = useMemo(() => [...contacts, ...appointments], [contacts, appointments]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((i) => {
      const bySearch = !q || i.name?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q) || i.phone?.includes(q) || i.company?.toLowerCase().includes(q);
      const byType = typeFilter === "all" || i.type === typeFilter;
      const byStatus = statusFilter === "all" || i.status === statusFilter;
      return bySearch && byType && byStatus;
    });
  }, [all, search, typeFilter, statusFilter]);

  const stats = useMemo(() => ({
    contacts: contacts.length,
    appointments: appointments.length,
    newContacts: contacts.filter(c => c.status === "new").length,
    pending: appointments.filter(a => a.status === "pending").length,
  }), [contacts, appointments]);

  function openEmail(item: BaseItem) {
    setEmailItem(item);
    setEmailBody(`مرحباً ${item.name || ""},\n\nشكراً لتواصلك. سنقوم بالرد قريباً.\n\nتحياتنا`);
  }
  function sendEmail() {
    if (!emailItem?.email) return alert("لا يوجد بريد إلكتروني");
    const link = `mailto:${emailItem.email}?subject=${encodeURIComponent("رد على طلبك")}&body=${encodeURIComponent(emailBody)}`;
    window.open(link, "_blank");
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify({ contacts, appointments }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `hr-data-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  async function addRecord() {
    const col = newEntry.type === "contact" ? "contacts" : "appointments";
    const data: any = { name: newEntry.name, email: newEntry.email, phone: newEntry.phone, message: newEntry.message, status: "new", timestamp: serverTimestamp() };
    if (newEntry.type === "contact") { data.company = newEntry.company; data.service = newEntry.service; }
    else { data.preferredDate = newEntry.preferredDate; data.preferredTime = newEntry.preferredTime; data.meetingType = newEntry.meetingType; }
    await addDoc(collection(db, col), data);
    setAddOpen(false);
    setNewEntry({ type: "contact", name: "", email: "", phone: "", company: "", service: "", preferredDate: "", preferredTime: "", meetingType: "in-person", message: "" });
    await load();
  }

  if (loading) {
    return (
      <div className="shell">
        <div className="loader"><div className="spinner"></div><div className="loader-text">جاري تحميل البيانات...</div></div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="header">
        <div className="brand">
          <div className="brand-logo">HR</div>
            <div>
            <h1 className="brand-title">لوحة تحكم الموارد البشرية</h1>
            <p className="brand-sub">نظام إدارة الحجوزات ورسائل التواصل</p>
            </div>
          </div>
        <div className="actions">
          <button className="btn" onClick={load}>تحديث</button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>إضافة جديد</button>
          <button className="btn" onClick={exportJson}>تصدير</button>
        </div>
      </header>

      <section className="stats">
        <div className="stat"><div className="stat-num">{stats.contacts}</div><div className="stat-label">رسائل التواصل</div></div>
        <div className="stat"><div className="stat-num">{stats.appointments}</div><div className="stat-label">المواعيد</div></div>
        <div className="stat"><div className="stat-num">{stats.pending}</div><div className="stat-label">بانتظار</div></div>
        <div className="stat"><div className="stat-num">{stats.newContacts}</div><div className="stat-label">طلبات جديدة</div></div>
      </section>

      <section className="filters">
        <input className="input" placeholder="بحث بالاسم/البريد/الهاتف/الشركة" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
          <option value="all">كل الأنواع</option>
          <option value="contact">رسائل</option>
          <option value="appointment">مواعيد</option>
            </select>
        <select className="input" value={statusFilter || "all"} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">كل الحالات</option>
          <option value="new">جديد</option>
          <option value="pending">قيد الانتظار</option>
          <option value="approved">موافق عليه</option>
          <option value="rejected">مرفوض</option>
            </select>
        <div className="results-count">عرض {filtered.length} من {all.length}</div>
      </section>

      <section className="list">
        {filtered.map((item) => (
          <article key={item.id} className="card dark">
            <div className="card-head">
                  <div>
                <h3 className="card-title">{item.name || "غير معروف"}</h3>
                <div className="card-meta">{item.type === "contact" ? "رسالة تواصل" : "موعد"} • {item.timestamp || "—"}</div>
                  </div>
              <span className={`badge ${item.status || "new"}`}>{item.status || "new"}</span>
                </div>
            <div className="grid">
              {item.email && <div className="pill">📧 {item.email}</div>}
              {item.phone && <div className="pill">📱 {item.phone}</div>}
              {item.company && <div className="pill">🏢 {item.company}</div>}
              {item.service && <div className="pill">🛠️ {item.service}</div>}
              {item.type === "appointment" && (<>
                {item.preferredDate && <div className="pill">📅 {item.preferredDate}</div>}
                {item.preferredTime && <div className="pill">⏰ {item.preferredTime}</div>}
                {item.meetingType && <div className="pill">📍 {item.meetingType === "in-person" ? "حضوري" : "عن بعد"}</div>}
              </>)}
                </div>
            {item.message && <p className="message">{item.message}</p>}
            <div className="card-actions">
              <button className="btn" onClick={() => setDetailItem(item)}>تفاصيل</button>
              <button className="btn btn-primary" onClick={() => openEmail(item)}>إرسال بريد</button>
              </div>
          </article>
        ))}
        {filtered.length === 0 && (<div className="empty">لا توجد بيانات مطابقة</div>)}
      </section>

      {detailItem && (
        <div className="modal" onClick={() => setDetailItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">تفاصيل {detailItem.type === "contact" ? "الرسالة" : "الموعد"}</h3>
            <div className="detail-grid">
              <div><span>الاسم:</span><b>{detailItem.name || "—"}</b></div>
              <div><span>الحالة:</span><b>{detailItem.status || "new"}</b></div>
              <div><span>البريد:</span><b>{detailItem.email || "—"}</b></div>
              <div><span>الهاتف:</span><b>{detailItem.phone || "—"}</b></div>
              {detailItem.company && <div><span>الشركة:</span><b>{detailItem.company}</b></div>}
              {detailItem.service && <div><span>الخدمة:</span><b>{detailItem.service}</b></div>}
              {detailItem.type === "appointment" && (<>
                <div><span>التاريخ:</span><b>{detailItem.preferredDate || "—"}</b></div>
                <div><span>الوقت:</span><b>{detailItem.preferredTime || "—"}</b></div>
                <div><span>النوع:</span><b>{detailItem.meetingType === "in-person" ? "حضوري" : "عن بعد"}</b></div>
              </>)}
              <div className="detail-col"><span>الرسالة:</span><b>{detailItem.message || "—"}</b></div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDetailItem(null)}>إغلاق</button>
              <button className="btn btn-primary" onClick={() => { setDetailItem(null); openEmail(detailItem); }}>إرسال بريد</button>
            </div>
          </div>
        </div>
      )}

      {emailItem && (
        <div className="modal" onClick={() => setEmailItem(null)}>
          <div className="modal-card email" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">إرسال بريد إلى {emailItem.email || "—"}</h3>
            <textarea className="textarea" rows={8} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
            <div className="modal-actions">
              <button className="btn" onClick={() => setEmailItem(null)}>إغلاق</button>
              <button className="btn btn-primary" onClick={sendEmail}>إرسال</button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="modal" onClick={() => setAddOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">إضافة سجل جديد</h3>
            <div className="form-grid">
              <label className="field"><span>النوع</span>
                <select className="input" value={newEntry.type} onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value as ItemType })}>
                  <option value="contact">رسالة</option>
                  <option value="appointment">موعد</option>
                </select>
              </label>
              <label className="field"><span>الاسم</span><input className="input" value={newEntry.name} onChange={(e)=>setNewEntry({...newEntry,name:e.target.value})} /></label>
              <label className="field"><span>البريد</span><input className="input" type="email" value={newEntry.email} onChange={(e)=>setNewEntry({...newEntry,email:e.target.value})} /></label>
              <label className="field"><span>الهاتف</span><input className="input" value={newEntry.phone} onChange={(e)=>setNewEntry({...newEntry,phone:e.target.value})} /></label>
              {newEntry.type === "contact" ? (<>
                <label className="field"><span>الشركة</span><input className="input" value={newEntry.company} onChange={(e)=>setNewEntry({...newEntry,company:e.target.value})} /></label>
                <label className="field"><span>الخدمة</span><input className="input" value={newEntry.service} onChange={(e)=>setNewEntry({...newEntry,service:e.target.value})} /></label>
              </>) : (<>
                <label className="field"><span>التاريخ</span><input className="input" type="date" value={newEntry.preferredDate} onChange={(e)=>setNewEntry({...newEntry,preferredDate:e.target.value})} /></label>
                <label className="field"><span>الوقت</span><input className="input" type="time" value={newEntry.preferredTime} onChange={(e)=>setNewEntry({...newEntry,preferredTime:e.target.value})} /></label>
                <label className="field"><span>نوع الاجتماع</span>
                  <select className="input" value={newEntry.meetingType} onChange={(e)=>setNewEntry({...newEntry,meetingType:e.target.value})}>
                    <option value="in-person">حضوري</option>
                    <option value="online">عن بعد</option>
                      </select>
                </label>
              </>)}
              <label className="field field-col"><span>الرسالة</span><textarea className="textarea" rows={5} value={newEntry.message} onChange={(e)=>setNewEntry({...newEntry,message:e.target.value})}></textarea></label>
                    </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setAddOpen(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={addRecord}>إضافة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
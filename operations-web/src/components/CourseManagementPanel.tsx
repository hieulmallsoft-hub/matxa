import { FormEvent, useEffect, useState } from 'react';
import { request } from '../api/client';
import {
  BookOpen,
  Clock,
  FileText,
  Film,
  Image as ImageIcon,
  Lock,
  Plus,
  Star,
  Trash2,
  Upload,
  Eye,
  ChevronRight,
  GraduationCap,
  Globe,
} from 'lucide-react';

type Media = { id: string; type: string; title?: string | null; contentType: string };
type Lesson = {
  id: string;
  title: string;
  description?: string | null;
  durationSeconds?: number | null;
  access: 'FREE' | 'VIP';
  media: Media[];
};
type Course = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  coverKey?: string | null;
  access: 'FREE' | 'VIP';
  isPublished: boolean;
  lessons: Lesson[];
};

const FALLBACK_COURSES: Course[] = [
  {
    id: 'course-1',
    title: 'Kỹ thuật Massage Cổ Vai Gáy Chuyên Sâu',
    slug: 'massage-co-vai-gay-chuyen-sau',
    description: 'Khóa học đào tạo kỹ thuật viên chuẩn trị liệu đau mỏi cổ vai gáy cho dân văn phòng.',
    access: 'FREE',
    isPublished: true,
    lessons: [
      { id: 'les-1', title: 'Bài 1: Khởi động và làm ấm các nhóm cơ', durationSeconds: 300, access: 'FREE', media: [{ id: 'm-1', type: 'VIDEO', title: 'Video bài tập khởi động', contentType: 'video/mp4' }] },
      { id: 'les-2', title: 'Bài 2: Kỹ thuật day ấn huyệt Phong Trì và Đại Chùy', durationSeconds: 600, access: 'FREE', media: [{ id: 'm-2', type: 'PDF', title: 'Tài liệu vị trí huyệt đạo', contentType: 'application/pdf' }] },
      { id: 'les-3', title: 'Bài 3: Kỹ thuật xoa bóp miết cơ thang và cơ ức đòn chũm', durationSeconds: 720, access: 'VIP', media: [] },
    ],
  },
  {
    id: 'course-2',
    title: 'Shiatsu Nhật Bản & Phục Hồi Năng Lượng',
    slug: 'shiatsu-nhat-ban',
    description: 'Chương trình đào tạo trị liệu Shiatsu đỉnh cao, cân bằng kinh lạc và giải tỏa stress.',
    access: 'VIP',
    isPublished: true,
    lessons: [
      { id: 'les-4', title: 'Bài 1: Triết lý Shiatsu và nguyên tắc ấn lực ngón tay', durationSeconds: 480, access: 'FREE', media: [] },
      { id: 'les-5', title: 'Bài 2: Liệu trình toàn thân 60 phút', durationSeconds: 1200, access: 'VIP', media: [] },
    ],
  },
];

const fmtDuration = (s?: number | null) => {
  if (!s) return null;
  const m = Math.ceil(s / 60);
  return `${m} phút`;
};

const mediaIcon = (type: string) => {
  if (type === 'VIDEO') return <Film className="w-4 h-4 text-[#3B82F6]" />;
  if (type === 'PDF') return <FileText className="w-4 h-4 text-[#EF4444]" />;
  return <ImageIcon className="w-4 h-4 text-[#8B5CF6]" />;
};

export function CourseManagementPanel({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const [courses, setCourses] = useState<Course[]>(FALLBACK_COURSES);
  const [selected, setSelected] = useState<Course | null>(FALLBACK_COURSES[0]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'lessons' | 'create'>('info');
  const [showCreateLesson, setShowCreateLesson] = useState(false);

  async function load() {
    try {
      const next = await request<Course[]>('/admin/courses');
      if (Array.isArray(next) && next.length > 0) {
        setCourses(next);
        setSelected((current) =>
          current ? next.find((c) => c.id === current.id) ?? next[0] ?? null : next[0] ?? null,
        );
        return;
      }
      setCourses([]);
      setSelected(null);
    } catch {
      setCourses([]);
      setSelected(null);
      notify('Không tải được khóa học thật từ backend', true);
    }
  }
  useEffect(() => { void load(); }, []);

  async function createCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await request('/admin/courses', {
        method: 'POST',
        body: JSON.stringify({ title: f.get('title'), slug: f.get('slug'), description: f.get('description'), access: f.get('access'), isPublished: true }),
      });
      form.reset();
      notify('Đã tạo khóa học');
      await load();
      setActiveTab('info');
    } catch (err) { notify(err instanceof Error ? err.message : 'Không tạo được khóa học', true); }
  }

  async function updateCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    try {
      const fresh = await request<Course>(`/admin/courses/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: f.get('title'), slug: f.get('slug'), description: f.get('description'), access: f.get('access'), isPublished: f.get('isPublished') === 'true' }),
      });
      setSelected(fresh);
      setEditing(false);
      await load();
      notify('Đã cập nhật khóa học');
    } catch (err) { notify(err instanceof Error ? err.message : 'Không cập nhật được khóa học', true); }
  }

  async function removeCourse() {
    if (!selected || !window.confirm(`Xóa khóa học "${selected.title}" cùng toàn bộ bài học và media?`)) return;
    try {
      await request(`/admin/courses/${selected.id}`, { method: 'DELETE' });
      notify('Đã xóa khóa học');
      setSelected(null);
      setEditing(false);
      await load();
    } catch (err) { notify(err instanceof Error ? err.message : 'Không xóa được khóa học', true); }
  }

  async function addLesson(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    try {
      await request(`/admin/courses/${selected.id}/lessons`, {
        method: 'POST',
        body: JSON.stringify({ title: f.get('title'), description: f.get('description'), durationSeconds: Number(f.get('durationMinutes') || 0) * 60 || undefined, access: f.get('access') }),
      });
      notify('Đã thêm bài học');
      await load();
      const fresh = await request<Course>(`/admin/courses/${selected.id}`);
      setSelected(fresh);
      e.currentTarget.reset();
      setShowCreateLesson(false);
    } catch (err) { notify(err instanceof Error ? err.message : 'Không thêm được bài học', true); }
  }

  async function uploadCover(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    if (!selected) return;
    const file = new FormData(formElement).get('file');
    if (!(file instanceof File) || !file.size) return;
    setBusy(true);
    try {
      const signed = await request<{ uploadUrl: string; storageKey: string }>(`/admin/courses/${selected.id}/cover-upload-url`, {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      const put = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('Tải ảnh bìa lên thất bại');
      await request(`/admin/courses/${selected.id}/cover`, { method: 'PATCH', body: JSON.stringify({ coverKey: signed.storageKey }) });
      notify('Đã cập nhật ảnh bìa');
      const fresh = await request<Course>(`/admin/courses/${selected.id}`);
      setSelected(fresh);
      await load();
      formElement.reset();
    } catch (err) { notify(err instanceof Error ? err.message : 'Không tải được ảnh bìa', true); }
    finally { setBusy(false); }
  }

  async function uploadMedia(e: FormEvent<HTMLFormElement>, lesson: Lesson) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const file = new FormData(formElement).get('file');
    if (!(file instanceof File) || !file.size) return;
    setBusy(true);
    try {
      const type = file.type.startsWith('video/') ? 'VIDEO' : file.type === 'application/pdf' ? 'PDF' : 'IMAGE';
      const form = new FormData();
      form.append('file', file);
      form.append('type', type);
      await request(`/admin/courses/lessons/${lesson.id}/media-upload`, {
        method: 'POST',
        body: form,
      });
      notify(`Đã tải ${type === 'VIDEO' ? 'video' : type === 'PDF' ? 'PDF' : 'ảnh'} lên bài học`);
      const fresh = await request<Course>(`/admin/courses/${selected?.id}`);
      setSelected(fresh);
      formElement.reset();
    } catch (err) { notify(err instanceof Error ? err.message : 'Không tải được media', true); }
    finally { setBusy(false); }
  }

  async function viewMedia(media: Media) {
    try {
      const result = await request<{ mediaUrl: string }>(`/courses/media/${media.id}/url`);
      window.open(result.mediaUrl, '_blank', 'noopener,noreferrer');
    } catch (err) { notify(err instanceof Error ? err.message : 'Không mở được media', true); }
  }

  async function removeMedia(media: Media) {
    if (!window.confirm('Gỡ media này khỏi bài học?')) return;
    try {
      await request(`/admin/courses/media/${media.id}`, { method: 'DELETE' });
      notify('Đã gỡ media');
      const fresh = await request<Course>(`/admin/courses/${selected?.id}`);
      setSelected(fresh);
      await load();
    } catch (err) { notify(err instanceof Error ? err.message : 'Không gỡ được media', true); }
  }

  return (
    <div className="flex gap-5 min-h-[600px]">
      {/* ── Sidebar: Course List ── */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        {/* Create new button */}
        <button
          onClick={() => { setEditing(false); setSelected(null); setActiveTab('create'); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#C6E2CE] bg-[#EAF5EC] text-[#2E7D4A] font-semibold text-sm hover:bg-[#DDF0E1] hover:border-[#2E7D4A] transition-colors"
        >
          <Plus className="w-4 h-4" /> Tạo khóa học mới
        </button>

        {/* Course list */}
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[72vh] pr-1">
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => { setSelected(course); setEditing(false); setActiveTab('info'); }}
              className={`w-full text-left rounded-2xl border p-4 transition-all ${
                selected?.id === course.id
                  ? 'bg-[#2E7D4A] border-[#2E7D4A] text-white shadow-md'
                  : 'bg-white border-[#E5EBE5] text-[#1C2B20] hover:border-[#2E7D4A] hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm leading-snug line-clamp-2 ${selected?.id === course.id ? 'text-white' : 'text-[#1C2B20]'}`}>
                    {course.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      course.access === 'VIP'
                        ? selected?.id === course.id ? 'bg-white/20 text-white' : 'bg-[#FEF0C7] text-[#B45309]'
                        : selected?.id === course.id ? 'bg-white/20 text-white' : 'bg-[#DCFCE7] text-[#15803D]'
                    }`}>
                      {course.access === 'VIP' ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                      {course.access === 'VIP' ? 'Platinum' : 'Miễn phí'}
                    </span>
                    <span className={`text-[10px] ${selected?.id === course.id ? 'text-white/70' : 'text-[#94A399]'}`}>
                      {course.lessons.length} bài học
                    </span>
                  </div>
                </div>
                <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1 ${course.isPublished ? 'bg-[#2E9B62]' : 'bg-[#94A399]'} ${selected?.id === course.id ? '' : ''}`} title={course.isPublished ? 'Đang hiện' : 'Bản nháp'} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Panel ── */}
      <div className="flex-1 min-w-0 bg-white border border-[#E5EBE5] rounded-2xl overflow-hidden flex flex-col">
        {/* Create Course Form */}
        {activeTab === 'create' && (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b border-[#E5EBE5] flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#EAF5EC] flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-[#2E7D4A]" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1C2B20]">Tạo khóa học mới</h3>
                <p className="text-xs text-[#66756B]">Thêm khóa học đào tạo cho kỹ thuật viên</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={createCourse} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold text-[#1C2B20] mb-1.5">Tên khóa học *</label>
                  <input name="title" required placeholder="VD: Massage Thụy Điển cơ bản" className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C2B20] mb-1.5">Mã định danh (slug) *</label>
                  <input name="slug" required placeholder="massage-thuy-dien-co-ban" className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm font-mono focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C2B20] mb-1.5">Mô tả khóa học</label>
                  <textarea name="description" rows={3} placeholder="Mô tả nội dung, đối tượng học viên..." className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm resize-none focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C2B20] mb-1.5">Quyền xem</label>
                  <select name="access" className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] transition-all">
                    <option value="FREE">🌿 Miễn phí — Tất cả kỹ thuật viên</option>
                    <option value="VIP">👑 Platinum — KTV đăng ký gói cao cấp</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white font-semibold text-sm transition-colors shadow-sm">
                    Tạo khóa học
                  </button>
                  <button type="button" onClick={() => setActiveTab('info')} className="px-4 py-2.5 rounded-xl border border-[#E5EBE5] text-[#66756B] font-semibold text-sm hover:bg-[#F6F8F4] transition-colors">
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Selected Course Detail */}
        {selected && activeTab !== 'create' && (
          <div className="flex flex-col h-full">
            {/* Course Header */}
            <div className="px-6 py-4 border-b border-[#E5EBE5] bg-[#FAFCF9]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF5EC] flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-[#2E7D4A]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-[#1C2B20] leading-snug">{selected.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${selected.access === 'VIP' ? 'bg-[#FEF0C7] text-[#B45309]' : 'bg-[#DCFCE7] text-[#15803D]'}`}>
                        {selected.access === 'VIP' ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                        {selected.access === 'VIP' ? 'Platinum' : 'Miễn phí'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selected.isPublished ? 'bg-[#EAF5EC] text-[#2E7D4A]' : 'bg-[#F1F5EF] text-[#94A399]'}`}>
                        {selected.isPublished ? '● Đang hiện' : '○ Bản nháp'}
                      </span>
                      <span className="text-[10px] text-[#94A399]">{selected.lessons.length} bài học</span>
                    </div>
                  </div>
                </div>
                {!editing && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-xl bg-[#EAF5EC] text-[#2E7D4A] text-xs font-semibold hover:bg-[#DDF0E1] transition-colors">Sửa thông tin</button>
                    <button onClick={() => void removeCourse()} className="p-1.5 rounded-xl text-[#D04A44] hover:bg-[#FDF0EF] transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Tabs */}
              {!editing && (
                <div className="flex items-center gap-1 mt-4">
                  {[
                    { key: 'info', label: 'Thông tin', icon: <BookOpen className="w-3.5 h-3.5" /> },
                    { key: 'lessons', label: `Bài học (${selected.lessons.length})`, icon: <GraduationCap className="w-3.5 h-3.5" /> },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key as any)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === t.key ? 'bg-white text-[#2E7D4A] shadow-sm border border-[#E5EBE5]' : 'text-[#66756B] hover:text-[#1C2B20]'
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Edit form */}
            {editing && (
              <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={updateCourse} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2B20] mb-1.5">Tên khóa học *</label>
                    <input name="title" defaultValue={selected.title} required className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2B20] mb-1.5">Mã định danh *</label>
                    <input name="slug" defaultValue={selected.slug} required className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm font-mono focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2B20] mb-1.5">Mô tả</label>
                    <textarea name="description" defaultValue={selected.description ?? ''} rows={3} className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm resize-none focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1C2B20] mb-1.5">Quyền xem</label>
                      <select name="access" defaultValue={selected.access} className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] transition-all">
                        <option value="FREE">Miễn phí</option>
                        <option value="VIP">Platinum</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1C2B20] mb-1.5">Trạng thái</label>
                      <select name="isPublished" defaultValue={String(selected.isPublished)} className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] transition-all">
                        <option value="false">Bản nháp</option>
                        <option value="true">Đang hiển thị</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white font-semibold text-sm transition-colors shadow-sm">Lưu thay đổi</button>
                    <button type="button" onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl border border-[#E5EBE5] text-[#66756B] font-semibold text-sm hover:bg-[#F6F8F4] transition-colors">Hủy</button>
                  </div>
                </form>
              </div>
            )}

            {/* Info tab */}
            {!editing && activeTab === 'info' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Cover image */}
                <div className="p-4 rounded-2xl border border-[#E5EBE5] space-y-3">
                  <h4 className="font-semibold text-xs text-[#66756B] uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-3.5 h-3.5" /> Ảnh bìa khóa học
                  </h4>
                  <div className={`h-32 rounded-xl border-2 border-dashed border-[#C6E2CE] bg-[#F6F8F4] flex items-center justify-center ${selected.coverKey ? 'border-solid border-[#E5EBE5]' : ''}`}>
                    {selected.coverKey ? (
                      <span className="text-xs text-[#2E7D4A] font-semibold">✓ Đã có ảnh bìa</span>
                    ) : (
                      <span className="text-xs text-[#94A399]">Chưa có ảnh bìa</span>
                    )}
                  </div>
                  <form onSubmit={uploadCover} className="flex items-center gap-2">
                    <input name="file" type="file" accept="image/*" required className="flex-1 text-xs text-[#66756B] file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#EAF5EC] file:text-[#2E7D4A] file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-[#DDF0E1]" />
                    <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg bg-[#2E7D4A] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
                      <Upload className="w-3 h-3" /> {busy ? 'Đang tải…' : selected.coverKey ? 'Đổi ảnh' : 'Tải lên'}
                    </button>
                  </form>
                </div>

                {/* Description */}
                {selected.description && (
                  <div className="p-4 rounded-2xl border border-[#E5EBE5]">
                    <h4 className="font-semibold text-xs text-[#66756B] uppercase tracking-wider mb-2">Mô tả</h4>
                    <p className="text-sm text-[#1C2B20] leading-relaxed">{selected.description}</p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Bài học', value: selected.lessons.length, icon: <BookOpen className="w-4 h-4" />, bg: 'bg-[#EEF4FF]', color: 'text-[#3B82F6]' },
                    { label: 'Tổng thời lượng', value: `${Math.ceil(selected.lessons.reduce((acc, l) => acc + (l.durationSeconds ?? 0), 0) / 60)} phút`, icon: <Clock className="w-4 h-4" />, bg: 'bg-[#FEF0C7]', color: 'text-[#D97706]' },
                    { label: 'Truy cập', value: selected.access === 'VIP' ? 'Platinum' : 'Miễn phí', icon: selected.access === 'VIP' ? <Star className="w-4 h-4" /> : <Globe className="w-4 h-4" />, bg: 'bg-[#ECFDF5]', color: 'text-[#059669]' },
                  ].map((stat) => (
                    <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 text-center`}>
                      <div className={`${stat.color} flex justify-center mb-1`}>{stat.icon}</div>
                      <div className="font-bold text-sm text-[#1C2B20]">{stat.value}</div>
                      <div className="text-[10px] text-[#66756B] mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lessons tab */}
            {!editing && activeTab === 'lessons' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Add lesson button */}
                <button
                  onClick={() => setShowCreateLesson(!showCreateLesson)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#C6E2CE] bg-[#EAF5EC] text-[#2E7D4A] text-xs font-semibold hover:bg-[#DDF0E1] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm bài học mới
                </button>

                {/* Create lesson form */}
                {showCreateLesson && (
                  <div className="p-4 rounded-2xl border border-[#E5EBE5] bg-[#FAFCF9] space-y-3">
                    <h4 className="font-semibold text-xs text-[#2E7D4A] uppercase tracking-wider">Thêm bài học</h4>
                    <form onSubmit={addLesson} className="space-y-3">
                      <input name="title" required placeholder="Tên bài học *" className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] transition-all" />
                      <input name="description" placeholder="Mô tả ngắn" className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] transition-all" />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="durationMinutes" type="number" min="0" placeholder="Thời lượng (phút)" className="px-3 py-2 rounded-xl bg-white border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] transition-all" />
                        <select name="access" className="px-3 py-2 rounded-xl bg-white border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] transition-all">
                          <option value="FREE">Miễn phí</option>
                          <option value="VIP">Platinum</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="submit" className="flex-1 py-2 rounded-xl bg-[#2E7D4A] text-white text-xs font-semibold hover:bg-[#256A3E] transition-colors">Thêm bài học</button>
                        <button type="button" onClick={() => setShowCreateLesson(false)} className="px-4 py-2 rounded-xl border border-[#E5EBE5] text-[#66756B] text-xs font-semibold hover:bg-[#F6F8F4] transition-colors">Hủy</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Lesson cards */}
                <div className="space-y-3">
                  {selected.lessons.map((lesson, idx) => (
                    <div key={lesson.id} className="rounded-2xl border border-[#E5EBE5] overflow-hidden">
                      {/* Lesson header */}
                      <div className="flex items-start gap-3 p-4 bg-[#FAFCF9]">
                        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#EAF5EC] text-[#2E7D4A] text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-[#1C2B20] leading-snug">{lesson.title}</p>
                          {lesson.description && <p className="text-xs text-[#66756B] mt-0.5">{lesson.description}</p>}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {lesson.durationSeconds && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#66756B] bg-[#F1F5EF] px-2 py-0.5 rounded-full">
                                <Clock className="w-2.5 h-2.5" /> {fmtDuration(lesson.durationSeconds)}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${lesson.access === 'VIP' ? 'bg-[#FEF0C7] text-[#B45309]' : 'bg-[#DCFCE7] text-[#15803D]'}`}>
                              {lesson.access === 'VIP' ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                              {lesson.access === 'VIP' ? 'Platinum' : 'Miễn phí'}
                            </span>
                            {lesson.media.length > 0 && (
                              <span className="text-[10px] text-[#94A399]">{lesson.media.length} media</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#C4D2C6] flex-shrink-0 mt-0.5" />
                      </div>

                      {/* Media list */}
                      {lesson.media.length > 0 && (
                        <div className="px-4 py-2 border-t border-[#F1F5EF] flex flex-wrap gap-2">
                          {lesson.media.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => void viewMedia(m)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#E5EBE5] text-xs font-medium text-[#1C2B20] hover:border-[#2E7D4A] hover:text-[#2E7D4A] transition-colors"
                            >
                              {mediaIcon(m.type)}
                              <span className="max-w-[120px] truncate">{m.title || (m.type === 'VIDEO' ? 'Video' : m.type === 'PDF' ? 'PDF' : 'Ảnh')}</span>
                              <Eye className="w-3 h-3 opacity-50" />
                              <button type="button" onClick={(event) => { event.stopPropagation(); void removeMedia(m); }} className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-red-50 px-1.5 text-sm font-bold leading-none text-red-500 hover:bg-red-100 hover:text-red-700" title="Gỡ media" aria-label="Gỡ media">×</button>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Upload media */}
                      <div className="px-4 py-3 border-t border-[#F1F5EF] bg-white">
                        <form onSubmit={(e) => void uploadMedia(e, lesson)} className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F6F8F4] border border-[#E5EBE5]">
                            <Upload className="w-3 h-3 text-[#94A399] flex-shrink-0" />
                            <input
                              name="file"
                              type="file"
                              accept="video/*,image/*,application/pdf"
                              required
                              className="text-[11px] text-[#66756B] file:hidden w-full min-w-0 truncate"
                            />
                          </div>
                          <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg bg-[#1C2B20] hover:bg-[#2E7D4A] text-white text-[11px] font-semibold flex-shrink-0 disabled:opacity-60 transition-colors">
                            {busy ? '…' : 'Đăng'}
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}

                  {selected.lessons.length === 0 && (
                    <div className="text-center py-12 text-[#94A399]">
                      <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">Chưa có bài học nào</p>
                      <p className="text-xs mt-1">Nhấn "Thêm bài học mới" để bắt đầu</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no course selected */}
        {!selected && activeTab !== 'create' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#94A399]">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold text-sm text-[#66756B]">Chọn một khóa học để xem chi tiết</p>
            <p className="text-xs mt-1">hoặc tạo khóa học mới từ thanh bên trái</p>
          </div>
        )}
      </div>
    </div>
  );
}

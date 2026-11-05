import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { openFreshLink, request } from '../api/client';
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileSearch,
  ImageOff,
  Images,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
  Download,
  FileSignature,
} from 'lucide-react';
import { AnimatedNumber, Badge, Button, Card, Empty, SearchBox, SkeletonRows, Tabs, EASE } from './ui/kit';
import { DetailDrawer } from './common/DetailDrawer';
import { normalizeSearch } from '../navigation';

export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type ReviewAction = 'review' | 'approve' | 'reject';

export type TechnicianApplication = {
  id: string;
  status: ApplicationStatus;
  applicationType?: string | null;
  displayName: string | null;
  gender?: string | null;
  city: string | null;
  district: string | null;
  facility?: string | null;
  address?: string | null;
  bio?: string | null;
  supportedModes: string[];
  rejectionReason: string | null;
  idCardFrontKey?: string | null;
  idCardBackKey?: string | null;
  faceImageKey?: string | null;
  idCardNumber?: string | null;
  /** Read from the QR on the ID card by the app; dates are YYYY-MM-DD. */
  idCardInfo?: { fullName: string; dateOfBirth: string; permanentAddress: string; issueDate: string; issuePlace: string } | null;
  submittedAt?: string | null;
  underReviewAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt?: string;
  user: { id: string; displayName: string | null; avatarUrl?: string | null; phoneNumber?: string | null; email?: string | null };
  kyc?: { status: string; rejectionReason?: string | null; documents?: Array<{ type: string; storageKey: string }> } | null;
  _count?: { gallery: number };
  signedKyc?: Array<{ storageKey: string; viewUrl?: string }>;
  signedGallery?: Array<{ id: string; viewUrl?: string }>;
  contract?: {
    contractNumber: string;
    status: 'DRAFT' | 'SIGNED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
    signedAt: string | null;
    consent?: { ip?: string | null; device?: string | null; userAgent?: string | null; templateFileName?: string | null } | null;
    signatureUrl: string | null;
    signedDocumentUrl: string | null;
  } | null;
};

const CONTRACT_STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'gray' }> = {
  DRAFT: { label: 'Chưa ký', tone: 'gray' },
  SIGNED: { label: 'Đã ký', tone: 'blue' },
  PENDING_REVIEW: { label: 'Đã ký · chờ duyệt', tone: 'amber' },
  APPROVED: { label: 'Có hiệu lực', tone: 'green' },
  REJECTED: { label: 'Bị từ chối', tone: 'red' },
};

const STATUS: Record<ApplicationStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'gray' }> = {
  SUBMITTED: { label: 'Chờ duyệt', tone: 'amber' },
  UNDER_REVIEW: { label: 'Đang xem xét', tone: 'blue' },
  APPROVED: { label: 'Đã duyệt', tone: 'green' },
  REJECTED: { label: 'Từ chối', tone: 'red' },
  DRAFT: { label: 'Bản nháp', tone: 'gray' },
};

const KYC: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'gray' }> = {
  VERIFIED: { label: 'KYC đã xác minh', tone: 'green' },
  PENDING_VERIFICATION: { label: 'Chờ xác minh', tone: 'amber' },
  FACE_UPLOADED: { label: 'Đủ ảnh, chờ xác minh', tone: 'amber' },
  ID_UPLOADED: { label: 'Thiếu ảnh khuôn mặt', tone: 'amber' },
  REJECTED: { label: 'KYC bị từ chối', tone: 'red' },
  NOT_STARTED: { label: 'Chưa tải CCCD', tone: 'gray' },
};

const MODES: Record<string, string> = { HOME: 'Tận nơi', ONSITE: 'Tại cơ sở', ONLINE: 'Online' };
const GENDERS: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

// Waiting work first, then newest.
const ORDER: Record<ApplicationStatus, number> = { SUBMITTED: 0, UNDER_REVIEW: 1, DRAFT: 2, REJECTED: 3, APPROVED: 4 };

type Filter = 'ALL' | ApplicationStatus;

const nameOf = (app: TechnicianApplication) => app.displayName || app.user.displayName || 'Chưa đặt tên';
const areaOf = (app: TechnicianApplication) => [app.district, app.city].filter(Boolean).join(', ');
const sentAt = (app: TechnicianApplication) => app.submittedAt ?? app.createdAt ?? null;
const shortDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—');
const fullDate = (value?: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : null);

function relative(value?: string | null) {
  if (!value) return '';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} ngày trước` : shortDate(value);
}

const PALETTE = ['from-[#3C9A5E] to-[#2E7D4A]', 'from-[#E8A33D] to-[#C77F1A]', 'from-[#4F8FD8] to-[#2D6DB5]', 'from-[#C46BA8] to-[#9C4683]', 'from-[#5BB5A8] to-[#35867B]'];
const tint = (id: string) => PALETTE[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length];

function Avatar({ app, size = 'md' }: { app: TechnicianApplication; size?: 'md' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  const box = size === 'lg' ? 'w-14 h-14 text-base rounded-2xl' : 'w-10 h-10 text-xs rounded-xl';
  const initials = nameOf(app).split(/\s+/).slice(-2).map((word) => word[0]).join('').toUpperCase();
  return app.user.avatarUrl && !broken ? (
    <img src={app.user.avatarUrl} alt="" onError={() => setBroken(true)} className={`${box} object-cover shrink-0 ring-2 ring-white shadow-sm`} />
  ) : (
    <span className={`${box} shrink-0 bg-gradient-to-br ${tint(app.id)} text-white font-bold flex items-center justify-center ring-2 ring-white shadow-sm`}>
      {initials || 'KT'}
    </span>
  );
}

const ModeChips = ({ modes }: { modes: string[] }) =>
  modes.length ? (
    <div className="flex flex-wrap gap-1">
      {modes.map((mode) => (
        <span key={mode} className="px-2 py-0.5 rounded-md bg-surface-subtle border border-surface-border text-[11px] font-medium text-content-secondary">
          {MODES[mode] ?? mode}
        </span>
      ))}
    </div>
  ) : (
    <span className="text-xs text-content-tertiary">Chưa chọn</span>
  );

function KycBadge({ status }: { status?: string }) {
  const kyc = KYC[status ?? 'NOT_STARTED'] ?? { label: status ?? '—', tone: 'gray' as const };
  return <Badge tone={kyc.tone}>{kyc.tone === 'green' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}{kyc.label}</Badge>;
}

interface Props {
  applications: TechnicianApplication[] | null;
  loading: boolean;
  detail: TechnicianApplication | null;
  busyId: string | null;
  onOpen: (id: string) => void;
  onCloseDetail: () => void;
  onAction: (app: TechnicianApplication, action: ReviewAction) => void;
}

export function TechnicianApplicationsPanel({ applications, loading, detail, busyId, onOpen, onCloseDetail, onAction }: Props) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { ALL: 0, SUBMITTED: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0, DRAFT: 0 };
    for (const app of applications ?? []) {
      result.ALL += 1;
      result[app.status] += 1;
    }
    return result;
  }, [applications]);

  const visible = useMemo(() => {
    const needle = normalizeSearch(query);
    return (applications ?? [])
      .filter((app) => filter === 'ALL' || app.status === filter)
      .filter((app) =>
        !needle ||
        normalizeSearch(`${nameOf(app)} ${app.user.phoneNumber ?? ''} ${app.user.email ?? ''} ${areaOf(app)} ${app.id}`).includes(needle),
      )
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (sentAt(b) ?? '').localeCompare(sentAt(a) ?? ''));
  }, [applications, filter, query]);

  const tiles: Array<{ key: ApplicationStatus; label: string; hint: string; icon: ReactNode; accent: string }> = [
    { key: 'SUBMITTED', label: 'Chờ duyệt', hint: 'Cần xử lý', icon: <Clock className="w-5 h-5" />, accent: 'bg-[#FEF0E2] text-[#B5651D]' },
    { key: 'UNDER_REVIEW', label: 'Đang xem xét', hint: 'Đã nhận hồ sơ', icon: <FileSearch className="w-5 h-5" />, accent: 'bg-status-infoBg text-[#2970C2]' },
    { key: 'APPROVED', label: 'Đã duyệt', hint: 'Đã thành KTV', icon: <BadgeCheck className="w-5 h-5" />, accent: 'bg-primary-soft text-primary' },
    { key: 'REJECTED', label: 'Từ chối', hint: 'Chờ KTV sửa lại', icon: <XCircle className="w-5 h-5" />, accent: 'bg-status-dangerBg text-[#B9403A]' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile, index) => {
          const active = filter === tile.key;
          return (
            <motion.button
              key={tile.key}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05, ease: EASE }}
              whileHover={{ y: -2 }}
              onClick={() => setFilter(active ? 'ALL' : tile.key)}
              aria-pressed={active}
              className={`relative text-left p-4 rounded-2xl bg-white border transition-[border-color,box-shadow] ${
                active ? 'border-primary shadow-[0_0_0_3px_rgba(46,125,74,0.12)]' : 'border-surface-border hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tile.accent}`}>{tile.icon}</span>
                {tile.key === 'SUBMITTED' && counts.SUBMITTED > 0 && (
                  <span className="relative flex w-2.5 h-2.5 mt-1">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-[#E8A33D] opacity-60 animate-ping" />
                    <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-[#E8A33D]" />
                  </span>
                )}
              </div>
              <p className="mt-3 text-2xl font-bold text-content-primary tabular-nums">
                <AnimatedNumber value={counts[tile.key]} />
              </p>
              <p className="text-xs font-semibold text-content-primary">{tile.label}</p>
              <p className="text-[11px] text-content-tertiary">{tile.hint}</p>
            </motion.button>
          );
        })}
      </div>

      <Card
        bodyClassName="p-0"
        title="Hồ sơ đăng ký"
        subtitle={applications ? `${visible.length} / ${counts.ALL} hồ sơ · hồ sơ chờ duyệt xếp lên đầu` : 'Đang tải...'}
        actions={<SearchBox value={query} onChange={setQuery} placeholder="Tìm tên, SĐT, email, khu vực..." className="w-full sm:w-72" />}
      >
        <div className="px-5 pt-4 pb-3 border-b border-surface-borderSubtle">
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'ALL', label: 'Tất cả', count: counts.ALL },
              { value: 'SUBMITTED', label: 'Chờ duyệt', count: counts.SUBMITTED },
              { value: 'UNDER_REVIEW', label: 'Đang xem xét', count: counts.UNDER_REVIEW },
              { value: 'APPROVED', label: 'Đã duyệt', count: counts.APPROVED },
              { value: 'REJECTED', label: 'Từ chối', count: counts.REJECTED },
              { value: 'DRAFT', label: 'Bản nháp', count: counts.DRAFT },
            ]}
          />
        </div>

        {loading && !applications ? (
          <SkeletonRows rows={5} className="p-5" />
        ) : visible.length === 0 ? (
          <Empty
            icon={<UserCheck className="w-6 h-6" />}
            title={query ? 'Không tìm thấy hồ sơ phù hợp' : filter === 'SUBMITTED' ? 'Không còn hồ sơ chờ duyệt' : 'Chưa có hồ sơ'}
            description={query ? 'Thử tìm bằng tên khác, số điện thoại hoặc khu vực.' : 'Hồ sơ mới từ ứng dụng KTV sẽ hiện ở đây.'}
            action={query ? <Button size="sm" onClick={() => setQuery('')}>Xóa tìm kiếm</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-surface-borderSubtle">
            <AnimatePresence initial={false}>
              {visible.map((app, index) => {
                const status = STATUS[app.status];
                const pending = app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW';
                return (
                  <motion.li
                    key={app.id}
                    layout="position"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: Math.min(index, 8) * 0.03, ease: EASE } }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(app.id)}
                      className="group w-full text-left px-5 py-4 grid grid-cols-[auto_1fr_auto] lg:grid-cols-[minmax(220px,1.6fr)_minmax(170px,1.2fr)_minmax(140px,1fr)_minmax(150px,1fr)_auto] items-center gap-x-4 gap-y-2 bg-white hover:bg-surface-subtle/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 lg:col-auto col-span-2">
                        <span className="relative">
                          <Avatar app={app} />
                          {app.status === 'SUBMITTED' && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#E8A33D] ring-2 ring-white" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-content-primary truncate group-hover:text-primary transition-colors">{nameOf(app)}</p>
                          <p className="text-[11px] text-content-tertiary truncate">
                            {sentAt(app) ? <>Gửi {relative(sentAt(app))}</> : 'Chưa gửi'}
                            {app.gender && GENDERS[app.gender] ? ` · ${GENDERS[app.gender]}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="hidden lg:block min-w-0 text-xs space-y-0.5">
                        <p className="flex items-center gap-1.5 text-content-primary truncate">
                          <Phone className="w-3.5 h-3.5 text-content-tertiary shrink-0" />
                          {app.user.phoneNumber || <span className="text-content-tertiary">Chưa có SĐT</span>}
                        </p>
                        {app.user.email && (
                          <p className="flex items-center gap-1.5 text-content-secondary truncate">
                            <Mail className="w-3.5 h-3.5 text-content-tertiary shrink-0" />
                            {app.user.email}
                          </p>
                        )}
                      </div>

                      <div className="hidden lg:block min-w-0 space-y-1">
                        <p className="flex items-center gap-1.5 text-xs text-content-primary truncate">
                          <MapPin className="w-3.5 h-3.5 text-content-tertiary shrink-0" />
                          {areaOf(app) || <span className="text-content-tertiary">Chưa chọn khu vực</span>}
                        </p>
                        <ModeChips modes={app.supportedModes} />
                      </div>

                      <div className="hidden lg:flex flex-col items-start gap-1">
                        <Badge tone={status.tone} dot>{status.label}</Badge>
                        <KycBadge status={app.kyc?.status} />
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <span className="lg:hidden"><Badge tone={status.tone} dot>{status.label}</Badge></span>
                        <span
                          className={`hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            pending ? 'bg-primary text-white group-hover:bg-primary-hover shadow-sm shadow-primary/25' : 'bg-surface-subtle text-content-secondary group-hover:bg-white group-hover:text-content-primary border border-surface-border'
                          }`}
                        >
                          {pending ? 'Xem & duyệt' : 'Xem hồ sơ'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-content-tertiary group-hover:translate-x-0.5 group-hover:text-primary transition-transform" />
                      </div>

                      <div className="lg:hidden col-span-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-content-secondary pl-[52px]">
                        {app.user.phoneNumber && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{app.user.phoneNumber}</span>}
                        {areaOf(app) && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{areaOf(app)}</span>}
                        <KycBadge status={app.kyc?.status} />
                      </div>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      <ApplicationDrawer detail={detail} busy={busyId !== null && busyId === detail?.id} onClose={onCloseDetail} onAction={onAction} />
    </div>
  );
}

/* ── Detail drawer ─────────────────────────────────────────────────────── */

function signedUrl(app: TechnicianApplication, legacyKey: string | null | undefined, docType: string) {
  const key = legacyKey ?? app.kyc?.documents?.find((document) => document.type === docType)?.storageKey;
  return key ? app.signedKyc?.find((item) => item.storageKey === key)?.viewUrl : undefined;
}

function Photo({ url, label, tall }: { url?: string; label: string; tall?: boolean }) {
  return (
    <figure className="space-y-1.5">
      <figcaption className="text-[11px] font-medium text-content-secondary">{label}</figcaption>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className={`group relative block ${tall ? 'aspect-[3/4]' : 'aspect-[16/10]'} rounded-xl overflow-hidden border border-surface-border bg-surface-subtle`}>
          <img src={url} alt={label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </a>
      ) : (
        <div className={`${tall ? 'aspect-[3/4]' : 'aspect-[16/10]'} rounded-xl border border-dashed border-[#CBD8CC] bg-surface-subtle flex flex-col items-center justify-center gap-1 text-[11px] text-content-tertiary`}>
          <ImageOff className="w-4 h-4" />
          Chưa có ảnh
        </div>
      )}
    </figure>
  );
}

const Section = ({ title, icon, children, aside }: { title: string; icon: ReactNode; children: ReactNode; aside?: ReactNode }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-content-secondary">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {aside}
    </div>
    {children}
  </section>
);

/** YYYY-MM-DD -> dd/MM/yyyy */
const vnDate = (iso: string) => iso.split('-').reverse().join('/');

const Info = ({ label, value }: { label: string; value?: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[11px] text-content-tertiary">{label}</dt>
    <dd className="text-sm font-medium text-content-primary break-words">{value || <span className="text-content-tertiary font-normal">Chưa cập nhật</span>}</dd>
  </div>
);

function ApplicationDrawer({ detail, busy, onClose, onAction }: {
  detail: TechnicianApplication | null;
  busy: boolean;
  onClose: () => void;
  onAction: (app: TechnicianApplication, action: ReviewAction) => void;
}) {
  const app = detail;
  const front = app ? signedUrl(app, app.idCardFrontKey, 'ID_CARD_FRONT') : undefined;
  const back = app ? signedUrl(app, app.idCardBackKey, 'ID_CARD_BACK') : undefined;
  const face = app ? signedUrl(app, app.faceImageKey, 'FACE_IMAGE') : undefined;
  const gallery = (app?.signedGallery ?? []).filter((image) => image.viewUrl);

  const checks = app
    ? [
        { label: 'CCCD mặt trước', ok: Boolean(front) },
        { label: 'CCCD mặt sau', ok: Boolean(back) },
        { label: 'Ảnh khuôn mặt', ok: Boolean(face) },
        { label: 'Khu vực hoạt động', ok: Boolean(app.city) },
        { label: 'Hình thức phục vụ', ok: app.supportedModes.length > 0 },
        { label: 'Ảnh dịch vụ', ok: gallery.length > 0 },
        { label: 'Đã ký hợp đồng', ok: Boolean(app.contract?.signedDocumentUrl) },
      ]
    : [];
  const passed = checks.filter((check) => check.ok).length;

  const timeline = app
    ? [
        { label: 'Gửi hồ sơ', at: app.submittedAt, tone: 'bg-[#E8A33D]' },
        { label: 'Bắt đầu xem xét', at: app.underReviewAt, tone: 'bg-[#4F8FD8]' },
        { label: 'Đã duyệt', at: app.approvedAt, tone: 'bg-primary' },
        { label: 'Từ chối', at: app.rejectedAt, tone: 'bg-status-danger' },
      ].filter((step) => step.at)
    : [];

  const canReview = app?.status === 'SUBMITTED';
  const canDecide = app?.status === 'SUBMITTED' || app?.status === 'UNDER_REVIEW';

  return (
    <DetailDrawer
      isOpen={Boolean(app)}
      onClose={onClose}
      width="xl"
      title={app ? nameOf(app) : ''}
      subtitle={app ? `Mã hồ sơ ${app.id.slice(0, 8).toUpperCase()}${app.submittedAt ? ` · gửi ${fullDate(app.submittedAt)}` : ''}` : undefined}
      badge={app ? <Badge tone={STATUS[app.status].tone} dot>{STATUS[app.status].label}</Badge> : undefined}
      footer={
        app && canDecide ? (
          <>
            <Button variant="danger" icon={<X className="w-4 h-4" />} disabled={busy} onClick={() => onAction(app, 'reject')}>Từ chối</Button>
            {canReview && (
              <Button icon={<FileSearch className="w-4 h-4" />} loading={busy} onClick={() => onAction(app, 'review')}>Nhận xem xét</Button>
            )}
            <Button variant="primary" icon={<Check className="w-4 h-4" />} loading={busy} onClick={() => onAction(app, 'approve')}>Duyệt thành KTV</Button>
          </>
        ) : (
          <Button onClick={onClose}>Đóng</Button>
        )
      }
    >
      {app && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-primary-soft to-white border border-[#D0E7D5]"
          >
            <Avatar app={app} size="lg" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-secondary">
                {app.user.phoneNumber && (
                  <a href={`tel:${app.user.phoneNumber}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone className="w-3.5 h-3.5" />{app.user.phoneNumber}</a>
                )}
                {app.user.email && (
                  <a href={`mailto:${app.user.email}`} className="inline-flex items-center gap-1 hover:text-primary truncate"><Mail className="w-3.5 h-3.5" />{app.user.email}</a>
                )}
                {!app.user.phoneNumber && !app.user.email && <span>Chưa có thông tin liên hệ</span>}
              </div>
              <ModeChips modes={app.supportedModes} />
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-primary tabular-nums">{passed}/{checks.length}</p>
              <p className="text-[11px] text-content-secondary">mục đầy đủ</p>
            </div>
          </motion.div>

          {app.status === 'REJECTED' && app.rejectionReason && (
            <div className="p-3.5 rounded-xl bg-status-dangerBg border border-[#F8D2D0] text-xs text-[#B9403A]">
              <span className="font-bold">Lý do từ chối: </span>{app.rejectionReason}
            </div>
          )}

          <Section title="Kiểm tra nhanh" icon={<CheckCircle2 className="w-4 h-4" />}>
            <ul className="grid grid-cols-2 gap-2">
              {checks.map((check) => (
                <li key={check.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${check.ok ? 'bg-white border-surface-border text-content-primary' : 'bg-status-warningBg border-[#FBE3B8] text-[#A86A0C]'}`}>
                  {check.ok ? <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
                  {check.label}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Giấy tờ xác minh" icon={<ShieldCheck className="w-4 h-4" />} aside={<KycBadge status={app.kyc?.status} />}>
            <div className="grid grid-cols-[1fr_1fr_0.75fr] gap-3">
              <Photo url={front} label="CCCD mặt trước" />
              <Photo url={back} label="CCCD mặt sau" />
              <Photo url={face} label="Khuôn mặt" tall />
            </div>
            {app.idCardInfo ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-2xl bg-surface-subtle border border-surface-border">
                <Info label="Họ tên trên CCCD" value={app.idCardInfo.fullName} />
                <Info label="Số CCCD" value={app.idCardNumber} />
                <Info label="Ngày sinh" value={vnDate(app.idCardInfo.dateOfBirth)} />
                <Info label="Ngày cấp · Nơi cấp" value={`${vnDate(app.idCardInfo.issueDate)} · ${app.idCardInfo.issuePlace}`} />
                <div className="col-span-2"><Info label="Địa chỉ thường trú" value={app.idCardInfo.permanentAddress} /></div>
                <p className="col-span-2 text-[11px] text-content-tertiary">Đọc từ mã QR trên CCCD. Đối chiếu với ảnh trước khi duyệt.</p>
              </dl>
            ) : (
              <p className="text-xs text-content-secondary">
                {app.idCardNumber ? `Số CCCD ứng viên nhập: ${app.idCardNumber}. ` : ''}Chưa quét mã QR trên CCCD.
              </p>
            )}
            {app.kyc?.status === 'REJECTED' && app.kyc.rejectionReason && (
              <p className="text-xs text-[#B9403A]">KYC bị từ chối: {app.kyc.rejectionReason}</p>
            )}
          </Section>

          <Section
            title="Hợp đồng"
            icon={<FileSignature className="w-4 h-4" />}
            aside={app.contract ? <Badge tone={CONTRACT_STATUS[app.contract.status]?.tone ?? 'gray'} dot>{CONTRACT_STATUS[app.contract.status]?.label ?? app.contract.status}</Badge> : undefined}
          >
            {app.contract?.signedDocumentUrl ? (
              <div className="grid grid-cols-[1fr_auto] gap-4 p-4 rounded-2xl border border-surface-border">
                <dl className="space-y-2 text-xs">
                  <Info label="Số hợp đồng" value={app.contract.contractNumber} />
                  <Info label="Thời điểm ký" value={app.contract.signedAt ? fullDate(app.contract.signedAt) : null} />
                  <Info label="Mẫu hợp đồng" value={app.contract.consent?.templateFileName ?? 'Không có mẫu PDF'} />
                  <Info label="Thiết bị · IP" value={[app.contract.consent?.device, app.contract.consent?.ip].filter(Boolean).join(' · ') || null} />
                </dl>
                <div className="flex flex-col items-end gap-2">
                  {app.contract.signatureUrl && (
                    <img src={app.contract.signatureUrl} alt="Chữ ký" className="h-20 w-40 object-contain rounded-lg border border-surface-border bg-white" />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      openFreshLink(async () =>
                        (await request<TechnicianApplication>(`/admin/marketplace/technician-applications/${app.id}`)).contract?.signedDocumentUrl,
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover"
                  >
                    <Download className="w-4 h-4" /> Tải hợp đồng đã ký (PDF)
                  </button>
                </div>
              </div>
            ) : (
              <p className="p-3.5 rounded-xl bg-status-warningBg border border-[#FBE3B8] text-xs text-[#A86A0C]">
                Ứng viên chưa ký hợp đồng khi gửi hồ sơ (app chưa gửi chữ ký).
              </p>
            )}
          </Section>

          <Section title="Thông tin đăng ký" icon={<UserCheck className="w-4 h-4" />}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-2xl bg-surface-subtle border border-surface-border">
              <Info label="Tên hiển thị" value={nameOf(app)} />
              <Info label="Giới tính" value={app.gender ? GENDERS[app.gender] ?? app.gender : null} />
              <Info label="Khu vực" value={areaOf(app)} />
              <Info label="Cơ sở" value={app.facility} />
              <div className="col-span-2"><Info label="Địa chỉ" value={app.address} /></div>
            </dl>
            <div className="p-4 rounded-2xl border border-surface-border">
              <p className="text-[11px] text-content-tertiary mb-1">Giới thiệu bản thân</p>
              <p className="text-sm text-content-primary leading-relaxed whitespace-pre-line">
                {app.bio || <span className="text-content-tertiary">Ứng viên chưa viết giới thiệu.</span>}
              </p>
            </div>
          </Section>

          <Section title="Ảnh dịch vụ" icon={<Images className="w-4 h-4" />} aside={<span className="text-[11px] text-content-tertiary">{gallery.length} ảnh</span>}>
            {gallery.length ? (
              <div className="grid grid-cols-3 gap-2">
                {gallery.map((image) => (
                  <a key={image.id} href={image.viewUrl} target="_blank" rel="noreferrer" className="group block aspect-square rounded-xl overflow-hidden border border-surface-border">
                    <img src={image.viewUrl} alt="Ảnh dịch vụ" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-content-tertiary">Ứng viên chưa tải ảnh dịch vụ.</p>
            )}
          </Section>

          {timeline.length > 0 && (
            <Section title="Lịch sử" icon={<CalendarDays className="w-4 h-4" />}>
              <ol className="relative border-l-2 border-surface-border ml-1.5 space-y-3">
                {timeline.map((step) => (
                  <li key={step.label} className="pl-4 relative">
                    <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white ${step.tone}`} />
                    <p className="text-xs font-semibold text-content-primary">{step.label}</p>
                    <p className="text-[11px] text-content-tertiary">{fullDate(step.at)}</p>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </>
      )}
    </DetailDrawer>
  );
}

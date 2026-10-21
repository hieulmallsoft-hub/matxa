import React from 'react';

export type StatusType =
  | 'active'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'warning'
  | 'draft'
  | string;

export interface StatusBadgeProps {
  status: StatusType;
  customLabel?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

const STATUS_MAP: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  // Active / Approved / Completed
  ACTIVE: {
    label: 'Đang hoạt động',
    bg: 'bg-[#EBF8F1]',
    text: 'text-[#2E9B62]',
    border: 'border-[#C8EED7]',
    dot: 'bg-[#2E9B62]',
  },
  Active: {
    label: 'Đang hoạt động',
    bg: 'bg-[#EBF8F1]',
    text: 'text-[#2E9B62]',
    border: 'border-[#C8EED7]',
    dot: 'bg-[#2E9B62]',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    bg: 'bg-[#EBF8F1]',
    text: 'text-[#2E9B62]',
    border: 'border-[#C8EED7]',
    dot: 'bg-[#2E9B62]',
  },
  Completed: {
    label: 'Hoàn thành',
    bg: 'bg-[#EBF8F1]',
    text: 'text-[#2E9B62]',
    border: 'border-[#C8EED7]',
    dot: 'bg-[#2E9B62]',
  },
  APPROVED: {
    label: 'Đã duyệt',
    bg: 'bg-[#EAF5EC]',
    text: 'text-[#2E7D4A]',
    border: 'border-[#D0E7D5]',
    dot: 'bg-[#2E7D4A]',
  },
  Confirmed: {
    label: 'Đã xác nhận',
    bg: 'bg-[#EAF5EC]',
    text: 'text-[#2E7D4A]',
    border: 'border-[#D0E7D5]',
    dot: 'bg-[#2E7D4A]',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    bg: 'bg-[#EAF5EC]',
    text: 'text-[#2E7D4A]',
    border: 'border-[#D0E7D5]',
    dot: 'bg-[#2E7D4A]',
  },

  // Processing / In Progress
  PROCESSING: {
    label: 'Đang thực hiện',
    bg: 'bg-[#EDF4FC]',
    text: 'text-[#2970C2]',
    border: 'border-[#CDE0F8]',
    dot: 'bg-[#4285D4]',
  },
  Processing: {
    label: 'Đang thực hiện',
    bg: 'bg-[#EDF4FC]',
    text: 'text-[#2970C2]',
    border: 'border-[#CDE0F8]',
    dot: 'bg-[#4285D4]',
  },
  IN_PROGRESS: {
    label: 'Đang thực hiện',
    bg: 'bg-[#EDF4FC]',
    text: 'text-[#2970C2]',
    border: 'border-[#CDE0F8]',
    dot: 'bg-[#4285D4]',
  },
  'In Progress': {
    label: 'Đang thực hiện',
    bg: 'bg-[#EDF4FC]',
    text: 'text-[#2970C2]',
    border: 'border-[#CDE0F8]',
    dot: 'bg-[#4285D4]',
  },
  UNDER_REVIEW: {
    label: 'Cần bổ sung',
    bg: 'bg-[#FEF6E9]',
    text: 'text-[#B87A14]',
    border: 'border-[#FBE3B8]',
    dot: 'bg-[#F2A93B]',
  },

  // Pending
  PENDING: {
    label: 'Chờ xác nhận',
    bg: 'bg-[#FEF6E9]',
    text: 'text-[#B87A14]',
    border: 'border-[#FBE3B8]',
    dot: 'bg-[#F2A93B]',
  },
  Pending: {
    label: 'Chờ xác nhận',
    bg: 'bg-[#FEF6E9]',
    text: 'text-[#B87A14]',
    border: 'border-[#FBE3B8]',
    dot: 'bg-[#F2A93B]',
  },
  SUBMITTED: {
    label: 'Chờ duyệt',
    bg: 'bg-[#FEF6E9]',
    text: 'text-[#B87A14]',
    border: 'border-[#FBE3B8]',
    dot: 'bg-[#F2A93B]',
  },

  // Cancelled / Rejected / Inactive
  CANCELLED: {
    label: 'Đã hủy',
    bg: 'bg-[#FDF0EF]',
    text: 'text-[#D04A44]',
    border: 'border-[#F8D2D0]',
    dot: 'bg-[#E05B55]',
  },
  Cancelled: {
    label: 'Đã hủy',
    bg: 'bg-[#FDF0EF]',
    text: 'text-[#D04A44]',
    border: 'border-[#F8D2D0]',
    dot: 'bg-[#E05B55]',
  },
  REJECTED: {
    label: 'Từ chối',
    bg: 'bg-[#FDF0EF]',
    text: 'text-[#D04A44]',
    border: 'border-[#F8D2D0]',
    dot: 'bg-[#E05B55]',
  },
  INACTIVE: {
    label: 'Tạm ẩn',
    bg: 'bg-[#F1F5EF]',
    text: 'text-[#66756B]',
    border: 'border-[#D0DCD1]',
    dot: 'bg-[#94A399]',
  },
  DRAFT: {
    label: 'Bản nháp',
    bg: 'bg-[#F1F5EF]',
    text: 'text-[#66756B]',
    border: 'border-[#D0DCD1]',
    dot: 'bg-[#94A399]',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  customLabel,
  size = 'sm',
  showDot = true,
}) => {
  const config = STATUS_MAP[status] || {
    label: customLabel || status,
    bg: 'bg-[#F1F5EF]',
    text: 'text-[#66756B]',
    border: 'border-[#E5EBE5]',
    dot: 'bg-[#94A399]',
  };

  const displayText = customLabel || config.label;

  const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-[11px]',
    md: 'px-3 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]} select-none`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      <span>{displayText}</span>
    </span>
  );
};

export default StatusBadge;

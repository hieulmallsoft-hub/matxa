/** What the QR code printed on a Vietnamese chip ID card (CCCD / thẻ căn cước) tells us. */
export type IdCardInfo = {
  source: 'QR';
  idNumber: string;
  oldIdNumber: string | null;
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | null;
  permanentAddress: string;
  issueDate: string; // YYYY-MM-DD
  issuePlace: string;
};

/** ddMMyyyy -> YYYY-MM-DD, or null when it is not a real date. */
const isoDate = (value: string) => {
  const match = /^(\d{2})(\d{2})(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return date.getUTCDate() === Number(dd) && date.getUTCMonth() === Number(mm) - 1 ? `${yyyy}-${mm}-${dd}` : null;
};

/**
 * The QR reads `so CCCD|so CMND cu|ho ten|ngay sinh|gioi tinh|dia chi thuong tru|ngay cap`, dates as ddMMyyyy.
 * Returns null when the text is not that, so the caller can say the scan was wrong.
 */
export function parseIdCardQr(raw: string): IdCardInfo | null {
  const parts = raw.trim().split('|').map((part) => part.trim());
  if (parts.length < 7) return null;
  const [idNumber, oldIdNumber, fullName, dob, gender, permanentAddress, issued] = parts;
  const dateOfBirth = isoDate(dob);
  const issueDate = isoDate(issued);
  if (!/^\d{12}$/.test(idNumber) || !fullName || !dateOfBirth || !issueDate) return null;
  const sex = gender.normalize('NFC').toLowerCase();
  return {
    source: 'QR',
    idNumber,
    oldIdNumber: oldIdNumber || null,
    fullName,
    dateOfBirth,
    gender: sex === 'nam' ? 'MALE' : sex === 'nữ' || sex === 'nu' ? 'FEMALE' : null,
    permanentAddress,
    issueDate,
    // The place is not in the QR; chip cards have a single issuer, which changed with the 2024 Identity Law.
    issuePlace: issueDate >= '2024-07-01' ? 'Bộ Công an' : 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
  };
}

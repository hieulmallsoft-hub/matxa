import { parseIdCardQr } from './id-card-qr';

describe('parseIdCardQr', () => {
  it('reads every field of a chip ID card QR', () => {
    expect(parseIdCardQr('001099012345|123456789|Nguyễn Văn An|01011999|Nam|Số 1 Trần Duy Hưng, Cầu Giấy, Hà Nội|15082021')).toEqual({
      source: 'QR',
      idNumber: '001099012345',
      oldIdNumber: '123456789',
      fullName: 'Nguyễn Văn An',
      dateOfBirth: '1999-01-01',
      gender: 'MALE',
      permanentAddress: 'Số 1 Trần Duy Hưng, Cầu Giấy, Hà Nội',
      issueDate: '2021-08-15',
      issuePlace: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
    });
  });

  it('knows cards issued under the 2024 law come from Bo Cong an, and tolerates no old number and extra fields', () => {
    const card = parseIdCardQr('027199001234||Trần Thị Bình|25021999|Nữ|Thôn Giền, Ngọc Thiện, Bắc Ninh|25022026|');
    expect(card).toMatchObject({ oldIdNumber: null, gender: 'FEMALE', issueDate: '2026-02-25', issuePlace: 'Bộ Công an' });
  });

  it.each([
    ['not a card QR', 'https://example.com'],
    ['too few fields', '001099012345|123|Nguyen Van An'],
    ['ID number not 12 digits', '00109901234|123456789|Nguyễn Văn An|01011999|Nam|Hà Nội|15082021'],
    ['impossible date', '001099012345|123456789|Nguyễn Văn An|31021999|Nam|Hà Nội|15082021'],
  ])('rejects %s', (_label, raw) => expect(parseIdCardQr(raw)).toBeNull());
});

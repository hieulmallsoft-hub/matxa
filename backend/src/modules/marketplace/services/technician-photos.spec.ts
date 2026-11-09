import { BadRequestException } from '@nestjs/common';
import { TechnicianApplicationsService } from './technician-applications.service';

// Profile photos and certificates: added any time (also after approval), reviewed by an admin, then shown to customers.
describe('technician profile photos and certificates', () => {
  const key = 'technician-applications/user-1/gallery/a.jpg';
  const subject = (application: { status: string }, existing = 0) => {
    const prisma: any = {
      technicianApplication: { upsert: jest.fn().mockResolvedValue({ id: 'app-1', displayName: 'Ngan', ...application }) },
      technicianApplicationGalleryImage: {
        count: jest.fn().mockResolvedValue(existing),
        create: jest.fn(async ({ data }: any) => ({ id: 'photo-1', ...data })),
        findUnique: jest.fn().mockResolvedValue({ kind: 'CERTIFICATE', application: { userId: 'user-1' } }),
        update: jest.fn(async ({ data }: any) => ({ id: 'photo-1', ...data })),
        findMany: jest.fn(),
      },
    };
    const storage = { createPrivateViewUrl: jest.fn(async (storageKey: string) => ({ viewUrl: `https://signed/${storageKey}`, expiresIn: 300 })) };
    const notifications = { notifyAdmins: jest.fn(), create: jest.fn(), sendPush: jest.fn().mockResolvedValue(undefined) };
    return { prisma, notifications, service: new TechnicianApplicationsService(prisma, storage as any, notifications as any) };
  };

  it('lets an approved technician add a certificate, which waits for an admin', async () => {
    const { prisma, notifications, service } = subject({ status: 'APPROVED' });
    await expect(service.addGalleryImage('user-1', key, 0, 'CERTIFICATE')).resolves.toMatchObject({
      kind: 'CERTIFICATE', status: 'PENDING', viewUrl: `https://signed/${key}`,
    });
    expect(prisma.technicianApplicationGalleryImage.count).toHaveBeenCalledWith({
      where: { applicationId: 'app-1', kind: 'CERTIFICATE', status: { not: 'REJECTED' } },
    });
    expect(notifications.notifyAdmins).toHaveBeenCalledWith('ADMIN_TECHNICIAN_PHOTO_PENDING', 'KTV cập nhật ảnh', expect.any(String), 'admin://technicianPhotos');
  });

  it('accepts photos while the application waits for review, without pinging admins twice', async () => {
    const { notifications, service } = subject({ status: 'SUBMITTED' });
    await expect(service.addGalleryImage('user-1', key)).resolves.toMatchObject({ kind: 'GALLERY', status: 'PENDING' });
    expect(notifications.notifyAdmins).not.toHaveBeenCalled();
  });

  it('caps certificates at 2 and profile photos at 6', async () => {
    await expect(subject({ status: 'APPROVED' }, 2).service.addGalleryImage('user-1', key, 0, 'CERTIFICATE')).rejects.toThrow('Toi da 2 anh chung chi');
    await expect(subject({ status: 'APPROVED' }, 6).service.addGalleryImage('user-1', key)).rejects.toThrow('Toi da 6 anh ho so');
  });

  it('needs a reason to reject a photo, and tells the technician', async () => {
    const { notifications, service } = subject({ status: 'APPROVED' });
    await expect(service.reviewPhoto('photo-1', 'REJECTED')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reviewPhoto('photo-1', 'REJECTED', 'Anh mo')).resolves.toMatchObject({ status: 'REJECTED', rejectionReason: 'Anh mo' });
    expect(notifications.create).toHaveBeenCalledWith('user-1', 'TECHNICIAN_PHOTO_REJECTED', 'Chứng chỉ chưa được duyệt', 'Anh mo', 'matxa://technician/application');
  });

  it('shows customers only approved photos, split into profile photos and certificates', async () => {
    const { prisma, service } = subject({ status: 'APPROVED' });
    prisma.technicianApplicationGalleryImage.findMany.mockResolvedValue([
      { id: 'g1', kind: 'GALLERY', storageKey: 'technician-applications/u/gallery/1.jpg' },
      { id: 'c1', kind: 'CERTIFICATE', storageKey: 'technician-applications/u/gallery/2.jpg' },
    ]);
    const photos = await service.publicPhotos('profile-1');
    expect(prisma.technicianApplicationGalleryImage.findMany.mock.calls[0][0].where).toMatchObject({ status: 'APPROVED' });
    expect(photos.gallery).toEqual([{ id: 'g1', viewUrl: 'https://signed/technician-applications/u/gallery/1.jpg', expiresIn: 300 }]);
    expect(photos.certificates.map((photo) => photo.id)).toEqual(['c1']);
  });
});

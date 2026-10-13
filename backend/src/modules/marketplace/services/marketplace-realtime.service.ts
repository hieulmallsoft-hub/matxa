import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class MarketplaceRealtimeService {
  private server?: Server;

  attach(server: Server) {
    this.server = server;
  }

  broadcastAvailabilityChanged(technicianId: string) {
    this.server?.to('marketplace:matching').emit('matching.updated', {
      technicianId,
      occurredAt: new Date().toISOString(),
    });
  }
}

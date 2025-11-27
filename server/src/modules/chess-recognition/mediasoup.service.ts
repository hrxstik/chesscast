import { Injectable, Logger } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import {
  Router,
  Worker,
  WebRtcTransport,
  Producer,
  Consumer,
} from 'mediasoup/node/lib/types';

interface MediaRoom {
  router: Router;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

@Injectable()
export class MediasoupService {
  private readonly logger = new Logger(MediasoupService.name);
  private worker: Worker | null = null;
  private rooms: Map<string, MediaRoom> = new Map();

  async initializeWorker() {
    if (this.worker) {
      return;
    }

    this.worker = await mediasoup.createWorker({
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });

    this.worker.on('died', () => {
      this.logger.error('Mediasoup worker died, exiting in 2 seconds...');
      setTimeout(() => process.exit(1), 2000);
    });

    this.logger.log('Mediasoup worker created');
  }

  async createRoom(roomId: string): Promise<Router> {
    if (!this.worker) {
      await this.initializeWorker();
    }

    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!.router;
    }

    const router = await this.worker!.createRouter({
      mediaCodecs: [
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    });

    const room: MediaRoom = {
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    this.rooms.set(roomId, room);
    this.logger.log(`Room ${roomId} created`);

    return router;
  }

  async createWebRtcTransport(
    roomId: string,
    clientId: string,
    direction: 'send' | 'recv',
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const transport = await room.router.createWebRtcTransport({
      listenIps: [
        {
          ip: '127.0.0.1',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    room.transports.set(clientId, transport);

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    transport.on('close', () => {
      room.transports.delete(clientId);
      this.logger.log(`Transport ${clientId} closed`);
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(
    roomId: string,
    clientId: string,
    dtlsParameters: mediasoup.types.DtlsParameters,
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const transport = room.transports.get(clientId);
    if (!transport) {
      throw new Error(`Transport ${clientId} not found`);
    }

    await transport.connect({ dtlsParameters });
  }

  async createProducer(
    roomId: string,
    clientId: string,
    transportId: string,
    rtpParameters: mediasoup.types.RtpParameters,
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const transport = room.transports.get(clientId);
    if (!transport) {
      throw new Error(`Transport ${clientId} not found`);
    }

    const producer = await transport.produce({
      kind: 'video',
      rtpParameters,
    });

    room.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      producer.close();
      room.producers.delete(producer.id);
    });

    return {
      id: producer.id,
      kind: producer.kind,
      rtpParameters: producer.rtpParameters,
    };
  }

  async createConsumer(
    roomId: string,
    clientId: string,
    transportId: string,
    producerId: string,
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const transport = room.transports.get(clientId);
    if (!transport) {
      throw new Error(`Transport ${clientId} not found`);
    }

    const producer = room.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer ${producerId} not found`);
    }

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: transport.rtpCapabilities,
    });

    room.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      consumer.close();
      room.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async closeRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    // Закрываем все транспорты
    for (const transport of room.transports.values()) {
      transport.close();
    }

    this.rooms.delete(roomId);
    this.logger.log(`Room ${roomId} closed`);
  }

  async getRouterRtpCapabilities(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      await this.createRoom(roomId);
      return this.rooms.get(roomId)!.router.rtpCapabilities;
    }

    return room.router.rtpCapabilities;
  }
}


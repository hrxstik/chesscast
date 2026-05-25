import { Injectable, Logger } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import { resolveMediasoupAnnouncedIp } from 'src/common/resolve-mediasoup-ip';

type Worker = Awaited<ReturnType<typeof mediasoup.createWorker>>;

interface MediaRoom {
  router: mediasoup.types.Router;
  transports: Map<string, mediasoup.types.WebRtcTransport>;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
  transportOwners: Map<string, string>;
  producerTransportId: Map<string, string>;
  consumerTransportId: Map<string, string>;
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

  async createRoom(roomId: string): Promise<mediasoup.types.Router> {
    if (!this.worker) {
      await this.initializeWorker();
    }

    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!.router;
    }

    const router = await this.worker!.createRouter({
      mediaCodecs: [
        // H.264 первым для лучшей совместимости с Safari/iPhone
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
      ],
    });

    const room: MediaRoom = {
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      transportOwners: new Map(),
      producerTransportId: new Map(),
      consumerTransportId: new Map(),
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
          // Слушаем на всех интерфейсах, а наружный IP берём из MEDIASOUP_ANNOUNCED_IP
          // (например, 192.168.1.143 в локалке)
          ip: '0.0.0.0',
          announcedIp: resolveMediasoupAnnouncedIp(),
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    room.transports.set(transport.id, transport);
    room.transportOwners.set(transport.id, clientId);

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        this.logger.log(
          `Transport ${transport.id} DTLS state changed to closed, closing transport`,
        );
        this.closeTransportInternal(room, roomId, transport.id);
      }
    });

    transport.on('@close', () => {
      this.logger.log(`Transport ${transport.id} @close event fired`);
      this.closeTransportInternal(room, roomId, transport.id);
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
    transportId: string,
    dtlsParameters: mediasoup.types.DtlsParameters,
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const transport = room.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    if (transport.dtlsState === 'connected') {
      this.logger.debug(`Transport ${transportId} already connected`);
      return;
    }
    await transport.connect({ dtlsParameters });
    this.logger.debug(`Transport ${transportId} connected`, {
      iceState: transport.iceState,
      dtlsState: transport.dtlsState,
    });

    transport.on('icestatechange', (state) => {
      this.logger.debug(`Transport ${transportId} ICE state: ${state}`);
      // Проверяем проблемные состояния ICE (disconnected - единственное проблемное состояние в типе IceState)
      if (state === 'disconnected') {
        this.logger.warn(`⚠️ Transport ${transportId} ICE state: ${state}`);
      }
    });

    transport.on('dtlsstatechange', (state) => {
      this.logger.debug(`Transport ${transportId} DTLS state: ${state}`);
      if (state === 'failed' || state === 'closed') {
        this.logger.warn(`⚠️ Transport ${transportId} DTLS state: ${state}`);
      }
    });
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

    const transport = room.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    // Проверяем состояние transport перед созданием producer
    const transportState = {
      id: transport.id,
      closed: transport.closed,
      iceState: transport.iceState,
      dtlsState: transport.dtlsState,
    };
    this.logger.debug(
      `Transport state before creating producer`,
      transportState,
    );

    if (transport.closed) {
      throw new Error(`Transport ${transport.id} is closed`);
    }

    const producer = await transport.produce({
      kind: 'video',
      rtpParameters,
    });

    room.producers.set(producer.id, producer);
    room.producerTransportId.set(producer.id, transport.id);
    this.logger.log(
      `Producer ${producer.id} created and saved in room ${roomId}. Total producers in room: ${room.producers.size}`,
    );

    // Добавляем обработчики событий producer для отладки
    producer.on('transportclose', () => {
      producer.close();
      room.producers.delete(producer.id);
      room.producerTransportId.delete(producer.id);
      this.logger.log(
        `Producer ${producer.id} removed from room ${roomId} due to transport close`,
      );
    });

    producer.on('@close', () => {
      this.logger.log(`Producer ${producer.id} @close event fired`);
      room.producers.delete(producer.id);
      room.producerTransportId.delete(producer.id);
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
    rtpCapabilities: mediasoup.types.RtpCapabilities,
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const transport = room.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    const producer = room.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer ${producerId} not found`);
    }

    const consumer = await transport.consume({
      producerId: producer.id,
      // Используем RTP‑возможности конкретного клиента, а не роутера
      rtpCapabilities,
    });

    room.consumers.set(consumer.id, consumer);
    room.consumerTransportId.set(consumer.id, transport.id);

    // Логируем состояние consumer
    this.logger.debug(`Consumer ${consumer.id} created for producer ${consumer.producerId}`);

    consumer.on('transportclose', () => {
      consumer.close();
      room.consumers.delete(consumer.id);
      room.consumerTransportId.delete(consumer.id);
      this.logger.log(`Consumer ${consumer.id} removed due to transport close`);
    });

    consumer.on('@close', () => {
      this.logger.log(`Consumer ${consumer.id} @close event fired`);
      room.consumers.delete(consumer.id);
      room.consumerTransportId.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeConsumer(roomId: string, consumerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const consumer = room.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer ${consumerId} not found`);
    }

    if (consumer.paused) {
      consumer.resume();
      this.logger.debug(`Consumer ${consumerId} resumed`);
    } else {
      this.logger.debug(`Consumer ${consumerId} already resumed`);
    }
  }

  /** Закрыть producer/consumer/transport, router комнаты оставить для переподключения зрителей. */
  async closeStreamMedia(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    for (const consumer of room.consumers.values()) {
      consumer.close();
    }
    for (const producer of room.producers.values()) {
      producer.close();
    }
    for (const transport of room.transports.values()) {
      transport.close();
    }
    room.consumers.clear();
    room.producers.clear();
    room.transports.clear();
    room.consumerTransportId.clear();
    room.producerTransportId.clear();
    room.transportOwners.clear();
    this.logger.log(`Stream media cleared in room ${roomId} (router kept)`);
  }

  closeClientMedia(roomId: string, clientId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const transportIds = [...room.transportOwners.entries()]
      .filter(([, ownerClientId]) => ownerClientId === clientId)
      .map(([transportId]) => transportId);
    for (const transportId of transportIds) {
      this.closeTransportInternal(room, roomId, transportId);
    }
  }

  private closeTransportInternal(
    room: MediaRoom,
    roomId: string,
    transportId: string,
  ): void {
    const transport = room.transports.get(transportId);
    if (!transport) return;
    for (const [consumerId, ownerTransportId] of [...room.consumerTransportId.entries()]) {
      if (ownerTransportId === transportId) {
        const consumer = room.consumers.get(consumerId);
        consumer?.close();
        room.consumers.delete(consumerId);
        room.consumerTransportId.delete(consumerId);
      }
    }
    for (const [producerId, ownerTransportId] of [...room.producerTransportId.entries()]) {
      if (ownerTransportId === transportId) {
        const producer = room.producers.get(producerId);
        producer?.close();
        room.producers.delete(producerId);
        room.producerTransportId.delete(producerId);
      }
    }
    if (!transport.closed) {
      transport.close();
    }
    room.transports.delete(transportId);
    room.transportOwners.delete(transportId);
    this.logger.log(`Transport ${transportId} closed in room ${roomId}`);
  }

  async closeRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

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

  async getProducers(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.warn(`Room ${roomId} not found when getting producers`);
      return [];
    }

    const producers = Array.from(room.producers.values()).map((producer) => ({
      id: producer.id,
      kind: producer.kind,
    }));

    return producers;
  }

  async hasActiveVideoProducer(roomId: string): Promise<boolean> {
    const producers = await this.getProducers(roomId);
    return producers.some((p) => p.kind === 'video');
  }
}

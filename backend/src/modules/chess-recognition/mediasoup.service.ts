import { Injectable, Logger } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import { resolveMediasoupAnnouncedIp } from 'src/common/resolve-mediasoup-ip';

type Worker = Awaited<ReturnType<typeof mediasoup.createWorker>>;

interface MediaRoom {
  router: mediasoup.types.Router;
  transports: Map<string, mediasoup.types.WebRtcTransport>;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
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

    room.transports.set(clientId, transport);

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        this.logger.log(
          `Transport ${clientId} DTLS state changed to closed, closing transport`,
        );
        transport.close();
        room.transports.delete(clientId);
        this.logger.log(`Transport ${clientId} closed`);
      }
    });

    transport.on('@close', () => {
      this.logger.log(`Transport ${clientId} @close event fired`);
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
    this.logger.log(`Transport ${clientId} connected:`, {
      iceState: transport.iceState,
      dtlsState: transport.dtlsState,
    });

    // Отслеживаем изменения состояния transport
    transport.on('icestatechange', (state) => {
      this.logger.log(`Transport ${clientId} ICE state changed: ${state}`);
      // Проверяем проблемные состояния ICE (disconnected - единственное проблемное состояние в типе IceState)
      if (state === 'disconnected') {
        this.logger.warn(`⚠️ Transport ${clientId} ICE state: ${state}`);
      }
    });

    transport.on('dtlsstatechange', (state) => {
      this.logger.log(`Transport ${clientId} DTLS state changed: ${state}`);
      if (state === 'failed' || state === 'closed') {
        this.logger.warn(`⚠️ Transport ${clientId} DTLS state: ${state}`);
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

    const transport = room.transports.get(clientId);
    if (!transport) {
      throw new Error(`Transport ${clientId} not found`);
    }

    // Проверяем состояние transport перед созданием producer
    const transportState = {
      id: transport.id,
      closed: transport.closed,
      iceState: transport.iceState,
      dtlsState: transport.dtlsState,
    };
    this.logger.log(
      `Transport state before creating producer:`,
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
    this.logger.log(
      `Producer ${producer.id} created and saved in room ${roomId}. Total producers in room: ${room.producers.size}`,
    );

    // Добавляем обработчики событий producer для отладки
    producer.on('transportclose', () => {
      producer.close();
      room.producers.delete(producer.id);
      this.logger.log(
        `Producer ${producer.id} removed from room ${roomId} due to transport close`,
      );
    });

    producer.on('@close', () => {
      this.logger.log(`Producer ${producer.id} @close event fired`);
      room.producers.delete(producer.id);
    });

    // Логируем состояние producer
    this.logger.log(`Producer ${producer.id} state:`, {
      id: producer.id,
      kind: producer.kind,
      paused: producer.paused,
      closed: producer.closed,
    });

    // Проверяем статистику producer через небольшую задержку
    setTimeout(async () => {
      try {
        const stats = await producer.getStats();
        const statsArray = Array.isArray(stats) ? stats : Object.values(stats);

        // Логируем все типы статистики для диагностики
        const statsTypes = statsArray.map((s: any) => s.type);
        this.logger.log(`Producer ${producer.id} stats after 2s:`, {
          statsCount: statsArray.length,
          statsTypes,
          allStats: statsArray.map((s: any) => ({
            type: s.type,
            timestamp: s.timestamp,
            bytesSent: s.bytesSent,
            packetsSent: s.packetsSent,
            bytesReceived: s.bytesReceived,
            packetsReceived: s.packetsReceived,
            framesEncoded: s.framesEncoded,
            framesDecoded: s.framesDecoded,
            framesSent: s.framesSent,
            framesReceived: s.framesReceived,
            width: s.width,
            height: s.height,
            frameWidth: s.frameWidth,
            frameHeight: s.frameHeight,
          })),
        });

        const videoStats = statsArray.find(
          (s: any) => s.type === 'outbound-rtp',
        ) as any;

        if (!videoStats) {
          this.logger.warn(
            `⚠️ Producer ${producer.id} has no outbound-rtp stats! Available types: ${statsTypes.join(', ')}`,
          );
        } else {
          this.logger.log(`Producer ${producer.id} outbound-rtp stats:`, {
            bytesSent: videoStats.bytesSent || 0,
            packetsSent: videoStats.packetsSent || 0,
            framesEncoded: videoStats.framesEncoded,
            framesSent: videoStats.framesSent,
            width: videoStats.width,
            height: videoStats.height,
            frameWidth: videoStats.frameWidth,
            frameHeight: videoStats.frameHeight,
          });

          if (videoStats.bytesSent === 0) {
            this.logger.warn(
              `⚠️ Producer ${producer.id} is not sending any data! Transport ICE state: ${transport.iceState}, DTLS: ${transport.dtlsState}`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to get producer stats: ${error.message}`);
      }
    }, 2000);

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
      // Используем RTP‑возможности конкретного клиента, а не роутера
      rtpCapabilities,
    });

    room.consumers.set(consumer.id, consumer);

    // Логируем состояние consumer
    this.logger.log(`Consumer ${consumer.id} created:`, {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      paused: consumer.paused,
      closed: consumer.closed,
    });

    consumer.on('transportclose', () => {
      consumer.close();
      room.consumers.delete(consumer.id);
      this.logger.log(`Consumer ${consumer.id} removed due to transport close`);
    });

    consumer.on('@close', () => {
      this.logger.log(`Consumer ${consumer.id} @close event fired`);
      room.consumers.delete(consumer.id);
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
      this.logger.log(`Consumer ${consumerId} resumed`);
    } else {
      this.logger.log(`Consumer ${consumerId} was already resumed`);
    }
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

    this.logger.log(
      `Found ${producers.length} producers in room ${roomId}: ${producers.map((p) => `${p.id}(${p.kind})`).join(', ')}`,
    );

    return producers;
  }

  async hasActiveVideoProducer(roomId: string): Promise<boolean> {
    const producers = await this.getProducers(roomId);
    return producers.some((p) => p.kind === 'video');
  }
}

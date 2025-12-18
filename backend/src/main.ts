import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const useHttps = process.env.USE_HTTPS === 'true';
  const port = parseInt(process.env.PORT ?? '5000', 10);
  const hostname = process.env.HOSTNAME || '0.0.0.0';

  let app;
  if (useHttps) {
    // HTTPS режим
    const certPath =
      process.env.SSL_CERT_PATH ||
      join(__dirname, '..', '..', '..', 'localhost+1.pem');
    const keyPath =
      process.env.SSL_KEY_PATH ||
      join(__dirname, '..', '..', '..', 'localhost+1-key.pem');

    try {
      const httpsOptions = {
        key: readFileSync(keyPath),
        cert: readFileSync(certPath),
      };
      app = await NestFactory.create(AppModule, { httpsOptions });
      console.log(`✅ HTTPS сертификаты загружены`);
    } catch (error) {
      console.error('❌ Ошибка загрузки HTTPS сертификатов:', error.message);
      console.error(
        'Сертификаты должны быть в корне проекта (localhost+1.pem и localhost+1-key.pem)',
      );
      console.error('Или укажите пути через SSL_CERT_PATH и SSL_KEY_PATH');
      process.exit(1);
    }
  } else {
    // HTTP режим (по умолчанию)
    app = await NestFactory.create(AppModule);
  }

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors(); // Включение CORS для WebSocket

  await app.listen(port, hostname);

  const protocol = useHttps ? 'https' : 'http';
  const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
  console.log(`Application is running on: ${protocol}://${hostname}:${port}`);
  console.log(`Local access: ${protocol}://${displayHost}:${port}`);
  if (hostname === '0.0.0.0') {
    console.log(`Network: ${protocol}://192.168.1.143:${port}`);
  }
}
bootstrap();

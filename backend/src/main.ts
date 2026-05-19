import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { readFileSync } from 'fs';
import { networkInterfaces } from 'os';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const useHttps = process.env.USE_HTTPS === 'true';
  const port = parseInt(process.env.PORT ?? '5000', 10);
  const hostname = process.env.HOSTNAME || '0.0.0.0';

  let app;
  if (useHttps) {
    // HTTPS режим
    const certPath = process.env.SSL_CERT_PATH;
    const keyPath = process.env.SSL_KEY_PATH;

    try {
      const httpsOptions = {
        key: readFileSync(keyPath ?? ''),
        cert: readFileSync(certPath ?? ''),
      };
      app = await NestFactory.create(AppModule, { httpsOptions });
      console.log(`✅ HTTPS certs loaded`);
    } catch (error) {
      console.error('❌ HTTPS certs error:', error.message);
      console.error('Certs must be in the root project directory');
      console.error(
        'Or specify paths through SSL_CERT_PATH and SSL_KEY_PATH environment variables',
      );
      process.exit(1);
    }
  } else {
    // HTTP режим (по умолчанию)
    app = await NestFactory.create(AppModule);
  }

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const frontendOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: frontendOrigins,
    credentials: true,
  });
  console.log(`CORS allowed origins: ${frontendOrigins.join(', ')}`);

  await app.listen(port, hostname);

  const protocol = useHttps ? 'https' : 'http';
  const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
  console.log(
    `Application is running on: ${protocol}://${displayHost}:${port}`,
  );

  if (hostname === '0.0.0.0') {
    const nets = networkInterfaces();
    const skipVirtual =
      /WSL|vEthernet|Docker|Hyper-V|VirtualBox|VMware|Loopback/i;
    for (const name of Object.keys(nets || {})) {
      if (skipVirtual.test(name)) continue;
      for (const net of nets[name] || []) {
        if (
          net.family === 'IPv4' &&
          !net.internal &&
          net.address.startsWith('192.168.')
        ) {
          console.log(`Network: ${protocol}://${net.address}:${port}`);
          return;
        }
      }
    }
  }
}
bootstrap();

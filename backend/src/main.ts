import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors(); // Включение CORS для WebSocket
  const port = process.env.PORT ?? 5000;
  await app.listen(port, '0.0.0.0'); // Слушаем на всех интерфейсах для доступа из сети
  console.log(`Application is running on: http://0.0.0.0:${port}`);
  console.log(`Local access: http://localhost:${port}`);
}
bootstrap();

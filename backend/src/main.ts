import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,https://sonic-ledger-web.onrender.com')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  if (!corsOrigins.includes('https://sonic-ledger-web.onrender.com')) {
    corsOrigins.push('https://sonic-ledger-web.onrender.com');
  }
  app.enableCors({ credentials: true, origin: corsOrigins });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const config = new DocumentBuilder().setTitle('Sonic Ledger API').setVersion('0.1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();

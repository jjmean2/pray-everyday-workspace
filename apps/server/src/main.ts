import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadLocalEnv } from './env.js';

loadLocalEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

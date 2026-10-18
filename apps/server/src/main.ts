import { NestFactory } from '@nestjs/core';
import { configureApp } from './app.setup.js';
import { assertSafeEnv, loadLocalEnv } from './env.js';

loadLocalEnv();
assertSafeEnv();

// 환경 변수를 읽은 뒤에 앱 모듈을 불러온다. 모듈 정의가 DEV_LOGIN 같은 값에 기대기 때문이다.
const { AppModule } = await import('./app.module.js');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

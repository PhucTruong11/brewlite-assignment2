import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './modules/prisma/prisma.service.js';
import { vi } from 'vitest';

describe('AppController', () => {
  let appController: AppController;
  const queryRaw = vi.fn();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('trả trạng thái sẵn sàng khi PostgreSQL phản hồi', async () => {
      queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      await expect(appController.getHealth()).resolves.toEqual({ status: 'ok', database: 'ok' });
    });

    it('trả 503 khi không kết nối được PostgreSQL', async () => {
      queryRaw.mockRejectedValueOnce(new Error('connection refused'));
      await expect(appController.getHealth()).rejects.toMatchObject({ status: 503 });
    });
  });
});

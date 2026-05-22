import supertest from 'supertest';
import { buildApp } from '../../../app';

const app = buildApp();

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                task: {
                    findUnique: jest.fn().mockResolvedValue({ id: 'task-1', customerId: 'user-1' })
                },
                message: {
                    findMany: jest.fn().mockResolvedValue([{ id: 'msg-1', content: 'hello', readAt: null, senderId: 'user-2' }]),
                    updateMany: jest.fn().mockResolvedValue({})
                }
            };
        })
    }
});

describe('Messaging REST API', () => {
  let server: any;
  let customerToken: string;

  beforeAll(async () => {
    await app.ready();
    server = app.server;
    customerToken = app.jwt.sign({ id: 'user-1', role: 'CUSTOMER' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/tasks/:taskId/messages', () => {
    it('should retrieve messages and mark read', async () => {
        const response = await supertest(server)
            .get('/api/v1/tasks/task-1/messages')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBe(1);
    });
  });
});

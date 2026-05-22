import { FastifyRequest, FastifyReply } from 'fastify';
import { MessagingService } from './messaging.service';
import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
});

export class MessagingController {
  static async getMessages(request: FastifyRequest<{ Params: { taskId: string }}>, reply: FastifyReply) {
      try {
          const userId = request.user!.id;
          const role = request.user!.role;
          const query = paginationSchema.parse(request.query);
          
          const messages = await MessagingService.getMessages(request.params.taskId, userId, role, query.page, query.limit);
          return reply.send({ success: true, data: messages });
      } catch (error: any) {
          if (error.message === 'NOT_FOUND') return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found or access denied' }});
          if (error.name === 'ZodError') return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }});
          
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch messages' }});
      }
  }
}

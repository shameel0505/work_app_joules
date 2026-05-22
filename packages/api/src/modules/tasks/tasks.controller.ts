import { FastifyRequest, FastifyReply } from 'fastify';
import { createTaskSchema, filterTasksSchema, availableTasksSchema } from './tasks.schema';
import { TasksService } from './tasks.service';

export class TasksController {
  static async createTask(request: FastifyRequest, reply: FastifyReply) {
      try {
          const customerId = request.user!.id;
          let bodyData: any = {};
          const photoBuffers: {buffer: Buffer, mimetype: string}[] = [];

          if (request.isMultipart()) {
             const parts = request.parts();
             for await (const part of parts) {
                  if (part.type === 'file') {
                      const buffer = await part.toBuffer();
                      photoBuffers.push({ buffer, mimetype: part.mimetype });
                  } else {
                      bodyData[part.fieldname] = part.value;
                  }
             }
             if (typeof bodyData.data === 'string') {
                  try { bodyData = JSON.parse(bodyData.data); } catch (e) {}
             }
          } else {
             bodyData = request.body || {};
          }

          const parsedData = createTaskSchema.parse(bodyData);
          const task = await TasksService.createTask(customerId, parsedData, photoBuffers);
          return reply.send({ success: true, data: task });

      } catch (error: any) {
          if (error.name === 'ZodError') {
              return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }});
          }
          if (error.message === 'MAX_PHOTOS_EXCEEDED' || error.message === 'INVALID_FILE_TYPE' || error.message === 'FILE_TOO_LARGE') {
              return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: error.message }});
          }
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not create task' }});
      }
  }

  static async getTasks(request: FastifyRequest, reply: FastifyReply) {
      try {
          const customerId = request.user!.id;
          const query = filterTasksSchema.parse(request.query);
          const tasks = await TasksService.getCustomerTasks(customerId, query.status, query.page, query.limit);
          return reply.send({ success: true, data: tasks });
      } catch (error: any) {
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch tasks' }});
      }
  }

  static async getTaskDetail(request: FastifyRequest<{ Params: { id: string }}>, reply: FastifyReply) {
      try {
          const userId = request.user!.id;
          const role = request.user!.role;
          const task = await TasksService.getTaskDetail(request.params.id, userId, role);
          return reply.send({ success: true, data: task });
      } catch (error: any) {
          if (error.message === 'NOT_FOUND') {
               return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' }});
          }
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch task details' }});
      }
  }

  static async cancelTask(request: FastifyRequest<{ Params: { id: string }}>, reply: FastifyReply) {
      try {
          const customerId = request.user!.id;
          const task = await TasksService.cancelTask(request.params.id, customerId);
          return reply.send({ success: true, data: task });
      } catch (error: any) {
          if (error.message === 'NOT_FOUND') return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' }});
          if (error.message === 'INVALID_STATUS') return reply.status(400).send({ success: false, error: { code: 'INVALID_STATUS', message: 'Can only cancel pending or accepted tasks' }});
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not cancel task' }});
      }
  }

  static async getAvailableTasks(request: FastifyRequest, reply: FastifyReply) {
      try {
          const taskerId = request.user!.id;
          const query = availableTasksSchema.parse(request.query);
          const tasks = await TasksService.getAvailableTasks(taskerId, query.lat, query.lng, query.radius_km, query.category_id);
          return reply.send({ success: true, data: tasks });
      } catch (error: any) {
           if (error.name === 'ZodError') {
              return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }});
          }
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch available tasks' }});
      }
  }
}

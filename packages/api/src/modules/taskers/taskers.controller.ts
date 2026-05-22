import { FastifyRequest, FastifyReply } from 'fastify';
import { updateTaskerSchema, updateAvailabilitySchema, updateLocationSchema } from './taskers.schema';
import { TaskersService } from './taskers.service';

export class TaskersController {
  static async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const profile = await TaskersService.getProfile(userId);
      if (!profile) {
          return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tasker profile not found' } });
      }
      return reply.send({ success: true, data: profile });
    } catch (error) {
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch tasker profile' } });
    }
  }

  static async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const data = updateTaskerSchema.parse(request.body);
      const profile = await TaskersService.updateProfile(userId, data);
      return reply.send({ success: true, data: profile });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
        }
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not update tasker profile' } });
    }
  }

  static async uploadEmiratesId(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const parts = request.parts();
      
      let frontBuffer: Buffer | null = null;
      let frontMimetype = '';
      let backBuffer: Buffer | null = null;
      let backMimetype = '';

      for await (const part of parts) {
          if (part.type === 'file') {
              if (part.fieldname === 'front') {
                  frontBuffer = await part.toBuffer();
                  frontMimetype = part.mimetype;
              } else if (part.fieldname === 'back') {
                  backBuffer = await part.toBuffer();
                  backMimetype = part.mimetype;
              }
          }
      }

      if (!frontBuffer || !backBuffer) {
          return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Both front and back images are required' } });
      }

      const profile = await TaskersService.uploadEmiratesId(userId, frontBuffer, frontMimetype, backBuffer, backMimetype);
      return reply.send({ success: true, data: profile });
    } catch (error: any) {
        if (error.message === 'INVALID_FILE_TYPE') {
            return reply.status(400).send({ success: false, error: { code: 'INVALID_FILE_TYPE', message: 'Files must be images' } });
        }
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not upload Emirates ID' } });
    }
  }

  static async updateAvailability(request: FastifyRequest, reply: FastifyReply) {
      try {
          const userId = request.user!.id;
          const { isOnline } = updateAvailabilitySchema.parse(request.body);
          const profile = await TaskersService.updateAvailability(userId, isOnline);
          return reply.send({ success: true, data: profile });
      } catch (error: any) {
          if (error.name === 'ZodError') {
              return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
          }
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not update availability' } });
      }
  }

  static async updateLocation(request: FastifyRequest, reply: FastifyReply) {
      try {
          const userId = request.user!.id;
          const { lat, lng } = updateLocationSchema.parse(request.body);
          
          // Fast lightweight response
          reply.send({ success: true, data: { lat, lng } });

          // Fire and forget DB update if needed
          TaskersService.updateLocation(userId, lat, lng).catch(e => console.error('Failed to async update location', e));
          
          return reply;
      } catch (error: any) {
          if (error.name === 'ZodError') {
              return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
          }
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not update location' } });
      }
  }

  static async getPublicProfile(request: FastifyRequest<{ Params: { id: string }}>, reply: FastifyReply) {
      try {
          const { id } = request.params;
          const profile = await TaskersService.getPublicProfile(id);
          return reply.send({ success: true, data: profile });
      } catch (error: any) {
          if (error.message === 'NOT_FOUND') {
              return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tasker not found' } });
          }
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch public profile' } });
      }
  }

  static async getEarnings(request: FastifyRequest, reply: FastifyReply) {
      try {
          const userId = request.user!.id;
          const earnings = await TaskersService.getEarnings(userId);
          return reply.send({ success: true, data: earnings });
      } catch (error: any) {
          if (error.message === 'NOT_FOUND') return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tasker not found' }});
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch earnings' }});
      }
  }

  static async getEarningsTransactions(request: FastifyRequest, reply: FastifyReply) {
      try {
          const userId = request.user!.id;
          const query = require('./taskers.schema').earningsPaginationSchema.parse(request.query);
          const transactions = await TaskersService.getEarningsTransactions(userId, query.page, query.limit);
          return reply.send({ success: true, data: transactions });
      } catch (error: any) {
           if (error.name === 'ZodError') return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }});
           if (error.message === 'NOT_FOUND') return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tasker not found' }});
           return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch transactions' }});
      }
  }

  static async requestPayout(request: FastifyRequest, reply: FastifyReply) {
       try {
           const userId = request.user!.id;
           const { amount_fils, bank_name, iban } = require('./taskers.schema').payoutRequestSchema.parse(request.body);
           const result = await TaskersService.requestPayout(userId, amount_fils, bank_name, iban);
           return reply.send({ success: true, data: result });
       } catch (error: any) {
           if (error.name === 'ZodError') return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }});
           if (error.message === 'INSUFFICIENT_FUNDS') return reply.status(400).send({ success: false, error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient wallet balance for payout' }});
           return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not request payout' }});
       }
  }
}

import { FastifyRequest, FastifyReply } from 'fastify';
import { updateUserSchema, createAddressSchema } from './users.schema';
import { UsersService } from './users.service';

export class UsersController {
  static async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const profile = await UsersService.getProfile(userId);
      return reply.send({ success: true, data: profile });
    } catch (error) {
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch profile' } });
    }
  }

  static async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const data = updateUserSchema.parse(request.body);
      const profile = await UsersService.updateProfile(userId, data);
      return reply.send({ success: true, data: profile });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
        }
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not update profile' } });
    }
  }

  static async uploadAvatar(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      const data = await request.file();
      
      if (!data) {
          return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'No file uploaded' } });
      }

      const buffer = await data.toBuffer();
      const profile = await UsersService.uploadAvatar(userId, buffer, data.mimetype);
      
      return reply.send({ success: true, data: profile });
    } catch (error: any) {
        if (error.message === 'INVALID_FILE_TYPE') {
            return reply.status(400).send({ success: false, error: { code: 'INVALID_FILE_TYPE', message: 'File must be an image' } });
        }
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not upload avatar' } });
    }
  }

  static async getAddresses(request: FastifyRequest, reply: FastifyReply) {
      try {
          const userId = request.user!.id;
          const addresses = await UsersService.getAddresses(userId);
          return reply.send({ success: true, data: addresses });
      } catch (error) {
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not fetch addresses' } });
      }
  }

  static async createAddress(request: FastifyRequest, reply: FastifyReply) {
      try {
          const userId = request.user!.id;
          const data = createAddressSchema.parse(request.body);
          const address = await UsersService.createAddress(userId, data);
          return reply.send({ success: true, data: address });
      } catch (error: any) {
          if (error.name === 'ZodError') {
              return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
          }
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not create address' } });
      }
  }

  static async deleteAddress(request: FastifyRequest<{ Params: { id: string }}>, reply: FastifyReply) {
      try {
          const userId = request.user!.id;
          const addressId = request.params.id;
          await UsersService.deleteAddress(userId, addressId);
          return reply.send({ success: true, data: null });
      } catch (error: any) {
          if (error.message === 'NOT_FOUND') {
              return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Address not found' } });
          }
          return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not delete address' } });
      }
  }
}

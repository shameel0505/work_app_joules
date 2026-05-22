import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WalletController } from './wallet.controller';
import { authenticate } from '../../shared/middleware/authenticate';

export const walletRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate);
    
    app.get('/balance', WalletController.getBalance);
    app.get('/transactions', WalletController.getTransactions);
    app.post('/topup', WalletController.topup);
};

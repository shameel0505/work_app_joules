import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

let io: Server;

export const initializeSocket = (app: FastifyInstance) => {
    io = new Server(app.server, {
        cors: { origin: '*' }
    });

    // Authentication Middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error: Token missing'));
            }
            const decoded = app.jwt.verify(token) as { id: string, role: string };
            socket.data.user = decoded;
            next();
        } catch (error) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', async (socket: Socket) => {
        const userId = socket.data.user.id;
        const role = socket.data.user.role;

        // Join active task rooms
        try {
            let activeTasks = [];
            if (role === 'CUSTOMER') {
                activeTasks = await prisma.task.findMany({
                    where: { customerId: userId, status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] } },
                    select: { id: true }
                });
            } else if (role === 'TASKER') {
                const tasker = await prisma.tasker.findUnique({ where: { userId }});
                if (tasker) {
                    activeTasks = await prisma.task.findMany({
                        where: { taskerId: tasker.id, status: { in: ['ACCEPTED', 'IN_PROGRESS'] } },
                        select: { id: true }
                    });
                }
            }

            activeTasks.forEach(task => {
                socket.join(`task:${task.id}`);
            });
        } catch (e) {
            console.error('Failed to join rooms', e);
        }

        // Chat Events
        socket.on('message:send', async (payload) => {
            try {
                const { task_id, content, message_type } = payload;
                const task = await prisma.task.findUnique({ where: { id: task_id }, include: { tasker: true } });
                if (!task) return;

                const message = await prisma.message.create({
                    data: {
                        taskId: task_id,
                        senderId: userId,
                        content,
                        type: message_type === 'image' ? 'IMAGE' : 'TEXT'
                    },
                    include: { sender: { select: { firstName: true, avatarUrl: true } } }
                });

                io.to(`task:${task_id}`).emit('message:new', message);

                // Notify if recipient not in room (Dev mode console log)
                const room = io.sockets.adapter.rooms.get(`task:${task_id}`);
                const recipientId = role === 'CUSTOMER' && task.tasker ? task.tasker.userId : task.customerId;
                
                // Note: accurate presence check requires tracking socket.id to userId.
                // Simple assumption for dev log: if room size < 2, someone might be missing
                if (!room || room.size < 2) {
                     console.log(`PUSH: New message notification to user ${recipientId}`);
                }
            } catch (e) {
                console.error('Error sending message', e);
            }
        });

        socket.on('message:read', async (payload) => {
             try {
                const { task_id, message_id } = payload;
                const message = await prisma.message.update({
                    where: { id: message_id },
                    data: { readAt: new Date() }
                });
                io.to(`task:${task_id}`).emit('message:read_receipt', { message_id, read_at: message.readAt });
             } catch (e) {
                 console.error('Error marking message read', e);
             }
        });

        // Location Events
        socket.on('location:update', async (payload) => {
            try {
                const { task_id, lat, lng, heading, speed } = payload;
                
                if (role !== 'TASKER') return socket.disconnect();

                const tasker = await prisma.tasker.findUnique({ where: { userId }});
                if (!tasker) return socket.disconnect();

                const task = await prisma.task.findUnique({ where: { id: task_id }});
                if (!task || task.taskerId !== tasker.id) {
                    return socket.disconnect();
                }

                // Calculate simple ETA (distance in km / 30 km/h) * 60 mins
                function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
                    const R = 6371; 
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    return R * c;
                }

                const distanceKm = getDistance(lat, lng, task.locationLat, task.locationLng);
                const eta_minutes = Math.round((distanceKm / 30) * 60);

                io.to(`task:${task_id}`).emit('location:tasker_moved', { lat, lng, heading, eta_minutes });

                // Throttle DB updates to 10 seconds
                const throttleKey = `throttle:location:${tasker.id}`;
                const isThrottled = await redis.get(throttleKey);
                
                if (!isThrottled) {
                    await prisma.tasker.update({
                        where: { id: tasker.id },
                        data: { currentLat: lat, currentLng: lng }
                    });
                    await redis.set(throttleKey, '1', 'EX', 10);
                }
            } catch (e) {
                console.error('Error updating location', e);
            }
        });
    });
};

export const emitTaskStatusChanged = (taskId: string, newStatus: string, message: string) => {
    if (io) {
        io.to(`task:${taskId}`).emit('task:status_changed', {
            task_id: taskId,
            new_status: newStatus,
            timestamp: new Date().toISOString(),
            message
        });
    }
};

export const getIoInstance = () => io;

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const prisma = new PrismaClient();

export const matchTaskQueue = new Queue('match-task', { connection: redisConnection });

// Haversine formula in TypeScript
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export const matchTaskWorker = new Worker('match-task', async (job: Job) => {
    const { taskId, lat, lng, categoryId } = job.data;
    
    // Find online verified taskers
    const taskers = await prisma.tasker.findMany({
        where: {
            isOnline: true,
            isVerified: true,
            currentLat: { not: null },
            currentLng: { not: null },
        }
    });

    // Filter by radius and map distance
    const matchedTaskers = taskers.map(tasker => {
        const distance = getDistanceFromLatLonInKm(lat, lng, tasker.currentLat!, tasker.currentLng!);
        return { ...tasker, distance };
    }).filter(tasker => tasker.distance <= (tasker.serviceRadiusKm || 50));

    // Sort by rating DESC, distance ASC
    matchedTaskers.sort((a, b) => {
        if (b.rating !== a.rating) {
            return b.rating - a.rating; // Highest rating first
        }
        return a.distance - b.distance; // Shortest distance first
    });

    console.log(`Matched Taskers for task ${taskId}:`, matchedTaskers.map(t => t.id));

    // Delay 30 minutes to check if still pending
    setTimeout(async () => {
        const task = await prisma.task.findUnique({ where: { id: taskId }});
        if (task && task.status === 'PENDING') {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: 'NO_TASKERS_FOUND' }
            });
            console.log(`Task ${taskId} set to NO_TASKERS_FOUND due to 30m timeout.`);
        }
    }, 30 * 60 * 1000);

}, { connection: redisConnection });

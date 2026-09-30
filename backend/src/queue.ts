import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { cfg } from './config';
export const redis = new IORedis(cfg.redis, { maxRetriesPerRequest: null });
export const emailQueue = new Queue('emails', { connection: redis, defaultJobOptions: { removeOnComplete: 1000 } });

import Redis from "ioredis";
import { env } from "../config/env.js";

export const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : new Redis();

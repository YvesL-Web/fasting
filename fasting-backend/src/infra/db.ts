import "reflect-metadata";

import { DataSource } from "typeorm";
import { env } from "../config/env";

export const appDataSource = new DataSource({
  type: "postgres",
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  entities: [], // plus tard
  synchronize: false, // toujours false en prod
  // logging: env.NODE_ENV === "development"
  logging: false
});

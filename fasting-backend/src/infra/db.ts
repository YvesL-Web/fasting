import 'reflect-metadata'

import { DataSource } from 'typeorm'
import { env } from '../config/env'
import { UserEntity } from '../modules/users/user.entity'
import { RefreshTokenEntity } from '../modules/auth/entities/refresh-token.entity'
import { EmailVerificationTokenEntity } from '../modules/auth/entities/email-verification-token.entity'
import { PasswordResetTokenEntity } from '../modules/auth/entities/password-reset-token.entity'
import { FastEntity } from '../modules/fasts/fast.entity'
import { FoodEntryEntity } from '../modules/food/entities/food-entry.entity'
import { FoodItemEntity } from '../modules/food/entities/food-item.entity'
import { RecipeEntity } from '../modules/recipes/recipe.entity'

export const appDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  entities: [
    UserEntity,
    RefreshTokenEntity,
    EmailVerificationTokenEntity,
    PasswordResetTokenEntity,
    FastEntity,
    FoodEntryEntity,
    FoodItemEntity,
    RecipeEntity
  ],
  synchronize: false, // toujours false en prod
  logging: env.IS_DEV ? ['error', 'schema'] : ['error'],
  // logging: env.NODE_ENV === "development"
  // logging: false,
  migrations: ['src/migrations/*.ts']
})

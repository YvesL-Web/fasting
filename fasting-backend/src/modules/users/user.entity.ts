import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm'

import { USER_ROLES, SUBSCRIPTION_PLANS } from '@fasting/shared'

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string

  @Column({ type: 'varchar', length: 100 })
  displayName!: string

  @Column({ type: 'varchar', length: 5, default: 'en' })
  locale!: 'en' | 'fr' | 'de'

  @Column({
    type: 'varchar',
    length: 20,
    default: 'USER'
  })
  role!: (typeof USER_ROLES)[number]

  @Column({
    type: 'varchar',
    length: 30,
    default: 'FREE'
  })
  subscriptionPlan!: (typeof SUBSCRIPTION_PLANS)[number]

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt!: Date | null

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}

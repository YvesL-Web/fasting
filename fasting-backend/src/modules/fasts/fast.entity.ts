import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm'
import { UserEntity } from '../users/user.entity'
import { FAST_TYPES } from '@fasting/shared'

@Entity({ name: 'fasts' })
export class FastEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @Index()
  user!: UserEntity

  @Column({
    type: 'varchar',
    length: 10
  })
  type!: (typeof FAST_TYPES)[number]

  @Index()
  @Column({ type: 'timestamp' })
  startAt!: Date

  @Column({ type: 'timestamp', nullable: true })
  endAt!: Date | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}

import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, Index } from 'typeorm'
import { UserEntity } from '../../users/user.entity'

@Entity({ name: 'password_reset_tokens' })
export class PasswordResetTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user!: UserEntity

  @Index()
  @Column({ type: 'varchar', length: 255 })
  tokenHash!: string

  @Column({ type: 'timestamp' })
  expiresAt!: Date

  @Column({ type: 'boolean', default: false })
  used!: boolean

  @CreateDateColumn()
  createdAt!: Date
}

import { Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Column, Index } from 'typeorm'
import { UserEntity } from '../../users/user.entity'

@Entity({ name: 'refresh_tokens' })
export class RefreshTokenEntity {
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
  revoked!: boolean

  @CreateDateColumn()
  createdAt!: Date
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm'
import { UserEntity } from '../../users/user.entity'

export type FoodSource = 'GLOBAL' | 'USER'

@Entity({ name: 'food_items' })
export class FoodItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  // propriétaire (pour les aliments créés par l'utilisateur)
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: true })
  owner!: UserEntity | null

  @Index()
  @Column({ type: 'varchar', length: 255 })
  label!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  brand!: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  servingSize!: string | null // ex: "100 g", "1 portion"

  @Column({ type: 'int', nullable: true })
  calories!: number | null // pour la portion

  @Column({ type: 'float', nullable: true })
  proteinGrams!: number | null

  @Column({ type: 'float', nullable: true })
  carbsGrams!: number | null

  @Column({ type: 'float', nullable: true })
  fatGrams!: number | null

  @Column({ type: 'varchar', length: 20, default: 'GLOBAL' })
  source!: FoodSource

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}

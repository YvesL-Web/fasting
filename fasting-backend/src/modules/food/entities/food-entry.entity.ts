import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm'
import { UserEntity } from '../../users/user.entity'
import { FastEntity } from '../../fasts/fast.entity'
import { RecipeEntity } from '../../recipes/recipe.entity'
import { FoodItemEntity } from './food-item.entity'

@Entity({ name: 'food_entries' })
export class FoodEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user!: UserEntity

  @ManyToOne(() => FastEntity, { onDelete: 'SET NULL', nullable: true })
  fast!: FastEntity | null

  @ManyToOne(() => RecipeEntity, { onDelete: 'SET NULL', nullable: true })
  recipe!: RecipeEntity | null

  @ManyToOne(() => FoodItemEntity, { onDelete: 'SET NULL', nullable: true })
  foodItem!: FoodItemEntity | null

  @Column({ type: 'timestamp' })
  loggedAt!: Date

  @Column({ type: 'varchar', length: 255 })
  label!: string

  @Column({ type: 'int', nullable: true })
  calories!: number | null

  @Column({ type: 'float', nullable: true })
  proteinGrams!: number | null

  @Column({ type: 'float', nullable: true })
  carbsGrams!: number | null

  @Column({ type: 'float', nullable: true })
  fatGrams!: number | null

  @Column({ type: 'boolean', default: false })
  inEatingWindow!: boolean

  @Column({ type: 'boolean', default: false })
  isPostFast!: boolean

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}

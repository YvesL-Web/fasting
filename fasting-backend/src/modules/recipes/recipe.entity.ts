import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm'
import { UserEntity } from '../users/user.entity'

type Ingredient = {
  name: string
  quantity?: string | null
}

type Step = {
  order: number
  text: string
}

@Entity({ name: 'recipes' })
export class RecipeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  author!: UserEntity

  @Column({ type: 'varchar', length: 255 })
  title!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  imagePublicId!: string | null

  @Column({ type: 'boolean', default: false })
  isPublic!: boolean

  @Column({ type: 'int', nullable: true })
  prepTimeMinutes!: number | null

  @Column({ type: 'int', nullable: true })
  cookTimeMinutes!: number | null

  @Column({ type: 'int', nullable: true })
  servings!: number | null

  @Column({ type: 'int', nullable: true })
  totalCalories!: number | null

  @Column({ type: 'float', nullable: true })
  proteinGrams!: number | null

  @Column({ type: 'float', nullable: true })
  carbsGrams!: number | null

  @Column({ type: 'float', nullable: true })
  fatGrams!: number | null

  // tags simples (petit-déj, snack, boisson, post-fast, etc.)
  @Column({ type: 'simple-array', nullable: true })
  tags!: string[] | null

  @Column({ type: 'jsonb', nullable: true })
  ingredients!: Ingredient[] | null

  @Column({ type: 'jsonb', nullable: true })
  steps!: Step[] | null

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}

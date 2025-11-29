import { Repository, ILike } from 'typeorm'
import { FoodItemEntity } from '../entities/food-item.entity'
import { UserEntity } from '../../users/user.entity'
import { CreateFoodItemInput, SearchFoodItemsQuery } from '../schemas/food-item.schemas'
import { AppError, ERR } from '../../../utils/error'

export class FoodItemService {
  constructor(
    private readonly foodItemsRepo: Repository<FoodItemEntity>,
    private readonly usersRepo: Repository<UserEntity>
  ) {}

  async createUserFood(userId: string, input: CreateFoodItemInput): Promise<FoodItemEntity> {
    const user = await this.usersRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new AppError(ERR.NOT_FOUND, 'User not found')
    }

    const item = this.foodItemsRepo.create({
      owner: user,
      label: input.label,
      brand: input.brand ?? null,
      servingSize: input.servingSize ?? null,
      calories: input.calories ?? null,
      proteinGrams: input.proteinGrams ?? null,
      carbsGrams: input.carbsGrams ?? null,
      fatGrams: input.fatGrams ?? null,
      source: 'USER'
    })

    return this.foodItemsRepo.save(item)
  }

  async searchFoods(userId: string, query: SearchFoodItemsQuery): Promise<FoodItemEntity[]> {
    const limit = query.limit ?? 10
    const q = query.q.trim()

    if (!q) return []

    // stratégie simple : aliments globaux + aliments de l'utilisateur
    return this.foodItemsRepo.find({
      where: [
        { source: 'GLOBAL', label: ILike(`%${q}%`) },
        { source: 'USER', owner: { id: userId }, label: ILike(`%${q}%`) }
      ],
      order: { label: 'ASC' },
      take: limit
    })
  }
}

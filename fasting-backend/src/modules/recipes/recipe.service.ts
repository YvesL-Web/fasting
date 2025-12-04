import { Repository, ILike } from 'typeorm'
import { RecipeEntity } from './recipe.entity'
import { UserEntity } from '../users/user.entity'
import type { CreateRecipeInput, ListRecipesQuery, UpdateRecipeInput } from './recipe.schemas'
import { AppError, ERR } from '../../utils/error'
import { deleteCloudinaryImage, uploadRecipeImage } from '../../config/cloudinary'

export class RecipeService {
  constructor(
    private readonly recipesRepo: Repository<RecipeEntity>,
    private readonly usersRepo: Repository<UserEntity>
  ) {}

  private async getAuthorOrThrow(userId: string): Promise<UserEntity> {
    const user = await this.usersRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'User not found.' },
        { reason: 'USER_NOT_FOUND', userId }
      )
    }
    return user
  }

  async createRecipe(
    userId: string,
    input: CreateRecipeInput,
    imagePath?: string | null
  ): Promise<RecipeEntity> {
    const author = await this.getAuthorOrThrow(userId)

    let imageUrl: string | null = null
    let imagePublicId: string | null = null

    if (imagePath) {
      const upload = await uploadRecipeImage(imagePath)
      imageUrl = upload.url
      imagePublicId = upload.publicId
    }

    const recipe = this.recipesRepo.create({
      author,
      title: input.title,
      description: input.description ?? null,
      isPublic: input.isPublic ?? false,
      prepTimeMinutes: input.prepTimeMinutes ?? null,
      cookTimeMinutes: input.cookTimeMinutes ?? null,
      servings: input.servings ?? null,
      totalCalories: input.totalCalories ?? null,
      proteinGrams: input.proteinGrams ?? null,
      carbsGrams: input.carbsGrams ?? null,
      fatGrams: input.fatGrams ?? null,
      tags: input.tags ?? null,
      ingredients: input.ingredients ?? null,
      steps: input.steps ?? null,
      imageUrl,
      imagePublicId
    })

    return this.recipesRepo.save(recipe)
  }

  async updateRecipe(
    userId: string,
    recipeId: string,
    input: UpdateRecipeInput,
    newImagePath?: string | null
  ): Promise<RecipeEntity> {
    const recipe = await this.recipesRepo.findOne({
      where: { id: recipeId },
      relations: ['author']
    })

    if (!recipe) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'Recipe not found.' },
        { reason: 'RECIPE_NOT_FOUND', recipeId }
      )
    }

    if (!recipe.author || recipe.author.id !== userId) {
      throw new AppError(
        { ...ERR.FORBIDDEN, message: 'You cannot edit this recipe.' },
        { reason: 'NOT_AUTHOR_OF_RECIPE', recipeId }
      )
    }

    // maj image si nouvelle image fournie
    if (newImagePath) {
      const upload = await uploadRecipeImage(newImagePath)
      const oldPublicId = recipe.imagePublicId
      recipe.imageUrl = upload.url
      recipe.imagePublicId = upload.publicId

      // suppression ancienne image en best-effort
      if (oldPublicId && oldPublicId !== upload.publicId) {
        await deleteCloudinaryImage(oldPublicId)
      }
    }

    // maj champs
    if (input.title !== undefined) recipe.title = input.title
    if (input.description !== undefined) recipe.description = input.description ?? null
    if (input.isPublic !== undefined) recipe.isPublic = input.isPublic
    if (input.prepTimeMinutes !== undefined) recipe.prepTimeMinutes = input.prepTimeMinutes ?? null
    if (input.cookTimeMinutes !== undefined) recipe.cookTimeMinutes = input.cookTimeMinutes ?? null
    if (input.servings !== undefined) recipe.servings = input.servings ?? null
    if (input.totalCalories !== undefined) recipe.totalCalories = input.totalCalories ?? null
    if (input.proteinGrams !== undefined) recipe.proteinGrams = input.proteinGrams ?? null
    if (input.carbsGrams !== undefined) recipe.carbsGrams = input.carbsGrams ?? null
    if (input.fatGrams !== undefined) recipe.fatGrams = input.fatGrams ?? null
    if (input.tags !== undefined) recipe.tags = input.tags ?? null
    if (input.ingredients !== undefined) recipe.ingredients = input.ingredients ?? null
    if (input.steps !== undefined) recipe.steps = input.steps ?? null

    return this.recipesRepo.save(recipe)
  }

  async deleteRecipe(userId: string, recipeId: string): Promise<void> {
    const recipe = await this.recipesRepo.findOne({
      where: { id: recipeId },
      relations: ['author']
    })

    if (!recipe) {
      // idempotent
      return
    }

    if (!recipe.author || recipe.author.id !== userId) {
      throw new AppError(
        { ...ERR.FORBIDDEN, message: 'You cannot delete this recipe.' },
        { reason: 'NOT_AUTHOR_OF_RECIPE', recipeId }
      )
    }

    const publicId = recipe.imagePublicId
    await this.recipesRepo.remove(recipe)
    if (publicId) {
      await deleteCloudinaryImage(publicId)
    }
  }

  async getRecipeById(userId: string | null, recipeId: string): Promise<RecipeEntity> {
    const recipe = await this.recipesRepo.findOne({
      where: { id: recipeId },
      relations: ['author']
    })

    if (!recipe) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'Recipe not found.' },
        { reason: 'RECIPE_NOT_FOUND', recipeId }
      )
    }

    if (!recipe.isPublic && (!userId || recipe.author.id !== userId)) {
      throw new AppError(
        { ...ERR.FORBIDDEN, message: 'You cannot view this recipe.' },
        { reason: 'RECIPE_PRIVATE' }
      )
    }

    return recipe
  }

  async listRecipes(userId: string, query: ListRecipesQuery): Promise<RecipeEntity[]> {
    const where: any = {}

    if (query.scope === 'me') {
      where.author = { id: userId }
    } else {
      where.isPublic = true
    }

    if (query.tag) {
      // simple-array -> LIKE %tag%
      where.tags = ILike(`%${query.tag}%`)
    }

    if (query.search) {
      // simpliste : on fera mieux plus tard
      where.title = ILike(`%${query.search}%`)
    }

    return this.recipesRepo.find({
      where,
      relations: ['author'],
      order: { createdAt: 'DESC' },
      take: 50
    })
  }
}

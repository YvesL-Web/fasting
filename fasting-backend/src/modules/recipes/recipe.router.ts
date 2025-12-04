import { Router } from 'express'
import multer from 'multer'
import fs from 'fs/promises'
import path from 'path'
import { z } from 'zod'

import { appDataSource } from '../../infra/db'
import { RecipeEntity } from './recipe.entity'
import { UserEntity } from '../users/user.entity'
import { RecipeService } from './recipe.service'
import { createRecipeSchema, updateRecipeSchema, listRecipesQuerySchema } from './recipe.schemas'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { AppError, ERR } from '../../utils/error'

const recipesRepo = appDataSource.getRepository(RecipeEntity)
const usersRepo = appDataSource.getRepository(UserEntity)
const recipeService = new RecipeService(recipesRepo, usersRepo)

// stockage temporaire des images
const upload = multer({
  dest: path.join(process.cwd(), 'tmp', 'recipe-images'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(
        new AppError(
          { ...ERR.BAD_REQUEST, message: 'File must be an image.' },
          { reason: 'INVALID_MIME_TYPE', mime: file.mimetype }
        ) as any
      )
    }
    cb(null, true)
  }
})

export const recipesRouter = Router()

// GET /recipes?scope=public|me&tag=...&search=...
recipesRouter.get('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const parsed = listRecipesQuerySchema.parse(req.query)
    const recipes = await recipeService.listRecipes(req.userId, parsed)

    res.status(200).json({
      recipes: recipes.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        imageUrl: r.imageUrl,
        isPublic: r.isPublic,
        prepTimeMinutes: r.prepTimeMinutes,
        cookTimeMinutes: r.cookTimeMinutes,
        servings: r.servings,
        totalCalories: r.totalCalories,
        proteinGrams: r.proteinGrams,
        carbsGrams: r.carbsGrams,
        fatGrams: r.fatGrams,
        tags: r.tags ?? [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        author: {
          id: r.author.id,
          displayName: r.author.displayName
        }
      }))
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// GET /recipes/:id (public ou privée si auteur)
recipesRouter.get('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const idSchema = z.object({ id: z.uuid() })
    const { id } = idSchema.parse(req.params)

    const userId = req.userId ?? null
    const recipe = await recipeService.getRecipeById(userId, id)

    res.status(200).json({
      recipe: {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        isPublic: recipe.isPublic,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        servings: recipe.servings,
        totalCalories: recipe.totalCalories,
        proteinGrams: recipe.proteinGrams,
        carbsGrams: recipe.carbsGrams,
        fatGrams: recipe.fatGrams,
        tags: recipe.tags ?? [],
        ingredients: recipe.ingredients ?? [],
        steps: recipe.steps ?? [],
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
        author: {
          id: recipe.author.id,
          displayName: recipe.author.displayName
        }
      }
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// POST /recipes (multipart/form-data)
recipesRouter.post(
  '/',
  authMiddleware,
  upload.single('image'),
  async (req: AuthRequest, res, next) => {
    const file = req.file

    try {
      if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

      const input = createRecipeSchema.parse(req.body)
      const recipe = await recipeService.createRecipe(req.userId, input, file?.path)

      if (file) {
        await fs.unlink(file.path).catch(() => {})
      }

      res.status(201).json({
        recipe: {
          id: recipe.id,
          title: recipe.title,
          description: recipe.description,
          imageUrl: recipe.imageUrl,
          isPublic: recipe.isPublic,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
          servings: recipe.servings,
          totalCalories: recipe.totalCalories,
          proteinGrams: recipe.proteinGrams,
          carbsGrams: recipe.carbsGrams,
          fatGrams: recipe.fatGrams,
          tags: recipe.tags ?? [],
          ingredients: recipe.ingredients ?? [],
          steps: recipe.steps ?? [],
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt
        }
      })
    } catch (err) {
      if (file) {
        await fs.unlink(file.path).catch(() => {})
      }

      if (err instanceof z.ZodError) {
        return next(AppError.fromZod(err))
      }
      return next(err)
    }
  }
)

// PATCH /recipes/:id (multipart pour éventuellement changer l'image)
recipesRouter.patch(
  '/:id',
  authMiddleware,
  upload.single('image'),
  async (req: AuthRequest, res, next) => {
    const file = req.file

    try {
      if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

      const idSchema = z.object({ id: z.uuid() })
      const { id } = idSchema.parse(req.params)

      const input = updateRecipeSchema.parse(req.body)
      const recipe = await recipeService.updateRecipe(req.userId, id, input, file?.path)

      if (file) {
        await fs.unlink(file.path).catch(() => {})
      }

      res.status(200).json({
        recipe: {
          id: recipe.id,
          title: recipe.title,
          description: recipe.description,
          imageUrl: recipe.imageUrl,
          isPublic: recipe.isPublic,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
          servings: recipe.servings,
          totalCalories: recipe.totalCalories,
          proteinGrams: recipe.proteinGrams,
          carbsGrams: recipe.carbsGrams,
          fatGrams: recipe.fatGrams,
          tags: recipe.tags ?? [],
          ingredients: recipe.ingredients ?? [],
          steps: recipe.steps ?? [],
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt
        }
      })
    } catch (err) {
      if (file) {
        await fs.unlink(file.path).catch(() => {})
      }

      if (err instanceof z.ZodError) {
        return next(AppError.fromZod(err))
      }
      return next(err)
    }
  }
)

// DELETE /recipes/:id
recipesRouter.delete('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const idSchema = z.object({ id: z.uuid() })
    const { id } = idSchema.parse(req.params)

    await recipeService.deleteRecipe(req.userId, id)

    res.status(204).send()
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

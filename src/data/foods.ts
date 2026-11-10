import type { Food } from '../types'

const createdAt = '2026-01-01T00:00:00.000Z'

export const BUILT_IN_FOODS: Food[] = [
  ['egg-large', 'Large egg', '1 large egg', 72, 6.3, 0.4, 4.8],
  ['toast-wheat', 'Whole wheat toast', '1 slice', 90, 4, 16, 1.2],
  ['banana-medium', 'Banana', '1 medium', 105, 1.3, 27, 0.4],
  ['greek-yogurt', 'Nonfat Greek yogurt', '1 cup', 130, 23, 9, 0],
  ['chicken-breast', 'Grilled chicken breast', '6 oz', 280, 52, 0, 6],
  ['white-rice', 'Cooked white rice', '1 cup', 205, 4.3, 45, 0.4],
  ['mixed-vegetables', 'Mixed vegetables', '1 cup', 90, 4, 18, 1],
  ['salmon', 'Cooked salmon', '6 oz', 350, 38, 0, 22],
  ['potatoes', 'Roasted potatoes', '1 cup', 180, 4, 37, 3],
  ['protein-powder', 'Whey protein powder', '1 scoop', 120, 24, 3, 2],
  ['fairlife-milk', 'High-protein milk', '1 cup', 80, 13, 6, 0],
  ['peanut-butter', 'Peanut butter', '2 tbsp', 190, 8, 7, 16],
  ['oats', 'Rolled oats', '1/2 cup dry', 150, 5, 27, 3],
  ['ground-beef', 'Lean ground beef', '4 oz cooked', 240, 29, 0, 13],
  ['black-beans', 'Black beans', '1/2 cup', 114, 8, 20, 0.5],
  ['cheddar', 'Cheddar cheese', '1 oz', 115, 7, 1, 9],
  ['avocado', 'Avocado', '1/2 medium', 120, 1.5, 6, 11],
  ['apple', 'Apple', '1 medium', 95, 0.5, 25, 0.3],
  ['almonds', 'Almonds', '1 oz', 164, 6, 6, 14],
  ['cottage-cheese', 'Low-fat cottage cheese', '1 cup', 180, 28, 8, 5],
].map(([id, name, servingLabel, calories, protein, carbs, fat]) => ({
  id: String(id), name: String(name), servingLabel: String(servingLabel),
  calories: Number(calories), protein: Number(protein), carbs: Number(carbs), fat: Number(fat),
  source: 'built_in' as const, createdAt,
}))

export const FOOD_BY_ID = new Map(BUILT_IN_FOODS.map((food) => [food.id, food]))

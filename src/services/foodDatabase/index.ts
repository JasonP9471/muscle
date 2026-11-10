import { z } from 'zod'
import type { Food } from '../../types'

const LOCAL_BARCODES: Record<string, Omit<Food, 'id' | 'createdAt'>> = {
  '016000275287': { name: 'Old fashioned oats', brand: 'Demo pantry', servingLabel: '1/2 cup', calories: 150, protein: 5, carbs: 27, fat: 3, barcode: '016000275287', source: 'barcode' },
  '049000028911': { name: 'Cola', brand: 'Demo pantry', servingLabel: '12 fl oz', calories: 140, protein: 0, carbs: 39, fat: 0, barcode: '049000028911', source: 'barcode' },
  '028400090896': { name: 'Greek yogurt cup', brand: 'Demo pantry', servingLabel: '1 container', calories: 130, protein: 20, carbs: 8, fat: 0, barcode: '028400090896', source: 'barcode' },
}

const ProductSchema = z.object({
  status: z.number(),
  product: z.object({
    product_name: z.string().optional(), brands: z.string().optional(), serving_size: z.string().optional(),
    nutriments: z.object({
      'energy-kcal_serving': z.number().optional(), proteins_serving: z.number().optional(),
      carbohydrates_serving: z.number().optional(), fat_serving: z.number().optional(),
    }).optional(),
  }).optional(),
})

export async function lookupBarcode(barcode: string): Promise<Food> {
  const normalized = barcode.replace(/\D/g, '')
  if (normalized.length < 8) throw new Error('Enter a valid UPC or EAN barcode.')
  const local = LOCAL_BARCODES[normalized]
  if (local) return { ...local, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  if (import.meta.env.VITE_ENABLE_FOOD_DATABASE !== 'true') throw new Error('Barcode not found in the offline catalog. Create the food manually or enable the food database provider.')
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalized)}.json`)
    if (!response.ok) throw new Error('The food database did not respond.')
    const parsed = ProductSchema.parse(await response.json())
    const product = parsed.product
    const nutrition = product?.nutriments
    if (parsed.status !== 1 || !product?.product_name || !nutrition || nutrition['energy-kcal_serving'] === undefined) throw new Error('That barcode has no complete serving nutrition. Create it manually instead.')
    return {
      id: crypto.randomUUID(), name: product.product_name, brand: product.brands,
      servingLabel: product.serving_size || '1 serving', calories: nutrition['energy-kcal_serving'],
      protein: nutrition.proteins_serving ?? 0, carbs: nutrition.carbohydrates_serving ?? 0,
      fat: nutrition.fat_serving ?? 0, barcode: normalized, source: 'barcode', createdAt: new Date().toISOString(),
    }
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Unable to look up that barcode. Create the food manually instead.', { cause: error })
  }
}

import { localCatalogueImage } from './webshop-local-images.js';
import { normaliseAvailability } from './webshop-stock.js';

// Translate the shared POS/API catalogue into the storefront view model.
// No requests, invented prices or assignments to a category's arbitrary first group.
const number = (value) => value === null || value === '' || value === undefined ? null
  : (Number.isFinite(Number(value)) ? Number(value) : null);
const enabled = (value) => value === true || value === 1 || value === '1';
const portionTypes = { ONE_HALF: ['demi', '1/2'], ONE_QUARTER: ['quart', '1/4'], ONE_EIGHTH: ['huitieme', '1/8'] };

export function adaptShopCatalogue(rows, { mode } = {}) {
  if (!Array.isArray(rows)) throw new Error('Invalid shop catalogue: expected an array.');
  const products = [], categories = new Map(), seasons = new Map();
  for (const row of rows) {
    const translatedName = typeof row?.name === 'string' && row.name.trim() !== '' ? row.name : null;
    const baseName = typeof row?.base_name === 'string' && row.base_name.trim() !== '' ? row.base_name : null;
    const productName = translatedName || baseName;
    if (!row || row.id == null || !productName || !row.category
        || !row.webshop || !Array.isArray(row.portions) || !Array.isArray(row.availability_periods)) {
      throw new Error('Incomplete shop catalogue: request include=webshop,portions,availability_periods.');
    }
    if (!enabled(row.webshop_active) || !enabled(row.is_active)) continue;
    if (mode === 'delivery' && !enabled(row.office_delivery)) continue;
    if (mode === 'collect' && !enabled(row.click_and_collect)) continue;
    const price = number(row.webshop.price_gross);
    const officeOffer = row.shopping_context?.mode === 'office_offer';
    // A missing/non-positive price is not a free product or an estimated price.
    if (price === null || price < 0 || (price === 0 && !officeOffer)) continue;
    const categoryId = row.id_category;
    const groups = Array.isArray(row.category.groups) ? row.category.groups : [];
    const category = {
      categoryId,
      id: `category:${categoryId}`,
      img: row.category.webshop_image?.url
        || localCatalogueImage('category_icons', [categoryId, row.category.slug, row.category.base_name, row.category.name]),
      label: row.category.name || row.category_name,
    };

    // product_category_group is the parent of product_category in the ERP.
    // Build the storefront hierarchy in that same direction:
    // group -> category -> products. A category without a group remains a
    // standalone root item, so it never disappears from the shop.
    if (!groups.length) {
      if (!categories.has(category.id)) categories.set(category.id, {
        ...category, kind: 'category', subs: [],
      });
    }
    for (const group of groups) {
      const groupId = String(group.id);
      const key = `group:${groupId}`;
      if (!categories.has(key)) {
        categories.set(key, {
          id: key,
          groupId,
          kind: 'group',
          img: group.webshop_image?.url
            || localCatalogueImage('category_icons', [group.id, group.base_name, group.name]),
          label: group.name,
          subs: [],
        });
      }
      const parent = categories.get(key);
      if (!parent.subs.some((sub) => String(sub.categoryId) === String(categoryId))) {
        parent.subs.push(category);
      }
    }
    const portionOptions = (enabled(row.is_divisible) ? [] : row.portions).flatMap((portion) => {
      const type = portionTypes[portion.portion_type];
      const amount = number(portion.shop_price_gross);
      if (!type || !enabled(portion.is_active) || !enabled(portion.is_ready_for_sale) || amount === null || amount < 0 || (amount === 0 && !officeOffer)) return [];
      return [{ v: type[0], label: type[1], price: amount, id_product_portion: portion.id }];
    });
    const periods = row.availability_periods.filter((period) => enabled(period.is_active) && enabled(period.webshop_active));
    for (const period of periods) seasons.set(String(period.id), {
      id: String(period.id),
      label: period.name,
      img: period.photo?.url || localCatalogueImage('season_icons', [period.id, period.slug, period.name]),
    });
    products.push({
      id: Number(row.id), name: productName, price: row.office_whole_available === false && portionOptions.length ? portionOptions[0].price : price,
      is_weighted: enabled(row.is_divisible),
      webshop_bulk_quantity_enabled: enabled(row.webshop_bulk_quantity_enabled),
      cat_id: categoryId, cat: categoryId, category: row.category.name || row.category_name,
      groupIds: groups.map((group) => String(group.id)),
      seasons: periods.map((period) => String(period.id)),
      description: null, img: row.webshop_image?.url || localCatalogueImage('product_pictures', [row.id]),
      ingredients: row.webshop.ingredients,
      allergens: row.webshop.allergen_codes,
      vat_rate: number(row.tax_value_percent),
      click_and_collect: enabled(row.click_and_collect), office_delivery: enabled(row.office_delivery),
      no_delivery: !enabled(row.office_delivery),
      lead_time: Math.ceil((number(row.preparation_lead_time_hours) || 0) / 24),
      is_vegetarian: enabled(row.is_vegetarian),
      portions: portionOptions.length > 0,
      portionOptions: portionOptions.length ? [...(row.office_whole_available === false ? [] : [{ v: 'entier', price }]), ...portionOptions] : [],
      office_whole_available: row.office_whole_available !== false,
      availability: normaliseAvailability(row.webshop_availability, row.inventory_initialized_at),
      has_menu_options: enabled(row.has_menu_options),
      has_personalization: enabled(row.has_personalization),
    });
  }
  return { products, categories: [...categories.values()], assortments: [...seasons.values()] };
}

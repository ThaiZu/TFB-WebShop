import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptShopCatalogue } from '../webshop-catalog-adapter.js';
const product = (overrides = {}) => ({
  inventory_initialized_at: '2026-09-09 00:00:00', id: 11, name: 'Cake', id_category: 3, is_active: 1, webshop_active: 1,
  click_and_collect: 1, office_delivery: 0, is_divisible: 0,
  category: { id: 3, name: 'Cakes', groups: [{id: 8, name: 'Bakery'}, {id: 9, name: 'Desserts'}] },
  webshop: { price_gross: '12.50', allergen_codes: ['milk'], ingredients: 'Milk' },
  portions: [{ id: 101, portion_type: 'ONE_HALF', is_active: 1, is_ready_for_sale: true, shop_price_gross: '7.00' }],
  availability_periods: [{id: 4, name: 'Summer', is_active: 1, webshop_active: 1}, {id: 5, name: 'All year', is_active: 1, webshop_active: 1}],
  ...overrides,
});
test('one response provides product groups as parents, categories as children, seasons and priced portions', () => {
  const result = adaptShopCatalogue([product(), product({id:12})], {mode:'collect'});
  assert.equal(result.products.length,2); assert.equal(result.categories.length,2);
  assert.equal(result.assortments.length,2);
  assert.deepEqual(result.products[0].groupIds,['8','9']);
  assert.equal(result.categories[0].kind, 'group');
  assert.equal(result.categories[0].id, 'group:8');
  assert.deepEqual(result.categories[0].subs.map((sub) => sub.id), ['category:3']);
  assert.deepEqual(result.products[0].seasons,['4','5']);
  assert.equal(result.products[0].portionOptions[1].price,7);
  assert.equal(result.products[0].portionOptions[1].id_product_portion,101);
});
test('category image supplied by the webshop API takes priority over local icon guesses', () => {
  const result = adaptShopCatalogue([product({category: {id: 3, name: 'Bread', webshop_image: {url: 'https://images.example/categories/3.webp'}, groups: []}})], {mode:'collect'});
  assert.equal(result.categories[0].img, 'https://images.example/categories/3.webp');
  assert.equal(result.categories[0].kind, 'category');
  assert.equal(result.categories[0].id, 'category:3');
});
test('group image supplied by the webshop API is used for the parent storefront tile', () => {
  const result = adaptShopCatalogue([product({category: {id: 3, name: 'Bread', groups: [{id: 8, name: 'Bakery', webshop_image: {url: 'https://images.example/groups/8.webp'}}]}})], {mode:'collect'});
  assert.equal(result.categories[0].img, 'https://images.example/groups/8.webp');
});
test('product image supplied by the webshop API takes priority over the local fallback', () => {
  const result = adaptShopCatalogue([product({webshop_image: {url: 'https://images.example/products/11.webp'}})], {mode:'collect'});
  assert.equal(result.products[0].img, 'https://images.example/products/11.webp');
});
test('the translated API name is displayed and base_name is its fallback', () => {
  assert.equal(adaptShopCatalogue([product({name: 'Ciasto', base_name: 'Cake'})]).products[0].name, 'Ciasto');
  assert.equal(adaptShopCatalogue([product({name: '', base_name: 'Cake'})]).products[0].name, 'Cake');
});
test('availability period image supplied by the webshop API takes priority over the local fallback', () => {
  const result = adaptShopCatalogue([product({availability_periods: [{
    id: 4, name: 'Summer', is_active: 1, webshop_active: 1,
    photo: {url: 'https://images.example/periods/4.webp'},
  }]})], {mode:'collect'});
  assert.equal(result.assortments[0].img, 'https://images.example/periods/4.webp');
});
test('channels, flags and missing prices never produce sellable fallback products', () => {
  for (const row of [product({webshop_active:0}),product({is_active:0}),product({webshop:{price_gross:null}}),product({webshop:{price_gross:0}})]) {
    assert.equal(adaptShopCatalogue([row]).products.length,0);
  }
  assert.equal(adaptShopCatalogue([product()],{mode:'delivery'}).products.length,0);
  assert.equal(adaptShopCatalogue([]).categories.length,0);
  assert.throws(()=>adaptShopCatalogue({}),/array/);
  assert.throws(()=>adaptShopCatalogue([{}]),/Incomplete/);
});
test('weighted products keep kg pricing and do not acquire piece portions', () => {
  const row=adaptShopCatalogue([product({is_divisible:1,webshop:{price_gross:19,allergen_codes:null}})]).products[0];
  assert.equal(row.price,19); assert.equal(row.is_weighted,true);
  assert.equal(row.portions,false); assert.equal(row.allergens,null);
});

test('uninitialized stock stays visible with a blocked availability state, including legacy 999', () => {
  const item = adaptShopCatalogue([product({inventory_initialized_at:null,in_stock:999})]).products[0];
  assert.equal(item.availability.status, 'uninitialized');
  assert.equal(item.availability.quantity_available, null);
});

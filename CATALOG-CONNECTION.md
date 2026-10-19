# Shared shop catalogue

The storefront loads `/api/v1/shops/{id}/products/available` with
`webshop_active=1`, `alias_type=webshop`, `lang_code`, the selected `date`, and
`include=webshop,portions,availability_periods`. No catalogue database connection
or separate category/assortment request is used.

`webshop-catalog-adapter.js` maps one response to products, unique categories,
category groups and all webshop-visible availability periods. Category groups
are memberships inherited from the category, not a fabricated assignment to
one arbitrary group. A product can appear under several groups and periods.
The UI filters these locally. It reloads on shop, date, language or mode changes;
outdated responses are ignored and old products are cleared on context changes.

The adapter uses actual shop prices (the same field used by PosCartQuoteService),
never suggested_sale_price. Products without a positive shop price are omitted.
Only explicitly priced, active, ready-for-sale portions are offered. Their API
IDs are retained on configured cart lines. Channel flags filter collect/delivery.

## Data coverage and limits

- Product/category names, groups, tax, channel flags, preparation lead time,
  prices, portions and seasons come from the central API.
- Optional API webshop metadata provides raw allergen codes, ingredient text
  and a nullable price. Unknown allergens remain unknown, not “allergen-free”.
- No product photo or marketing-description source exists in this endpoint;
  existing placeholder illustrations remain and absent descriptions are hidden.
- Weighted products show a per-kg price. Ordering them remains disabled until
  the storefront supports entering weight_grams; the old quantity-only form
  cannot submit these products correctly. Explicit portions are separate from
  the weighted-product flag.
- POS in_stock is not mapped to webshop stock reservations or a daily quantity.
  Stock/reservation, order submission and payment endpoints still require their
  own migration and verification. This change does not certify checkout.
- Legacy menu builders, bundle offers and office-specific assortment rules are
  not supplied by this endpoint and have not been invented in the adapter.
  Those mechanisms need separate contracts if required in the storefront.

Local data checked during implementation had no webshop-enabled products for
shop 2, so an empty real catalogue is expected until products and relevant
channels are enabled and prices/date availability configured. No flags or prices
were changed during implementation.

Checks:

```sh
node --test tests/catalog-adapter.test.mjs
```

Verify in Network that product/category/season loading uses only the shared
shop endpoint. Check FR/NL, date and shop switching, category/group/season
filters, portions and product details. After enabling a product through the
existing administration UI, refresh the shop. Erroring or empty responses must
not leave products from the previous shop visible.

## Loading performance

Catalogue category/group lookups are reused within a single API request;
shop portion data is loaded in one SQL query instead of one per product.
Concurrent identical frontend reads share a promise, separated by URL and
customer token. Completed responses are not persisted or reused as a price cache.
The first four product images load eagerly, the remainder lazily, with async
decoding. Real photos still need appropriately sized WebP/AVIF thumbnails and
HTTP image caching when their source is connected; lazy loading does not reduce
the size of an oversized individual photo.

Local measurement for shop 2, 360 products and the full include set:
2.434/2.574/2.672 seconds before, 1.766/1.745/1.656 seconds after.
The full decoded JSON response matched the baseline exactly. These are local
API timings, not a production or real-photo browser benchmark.

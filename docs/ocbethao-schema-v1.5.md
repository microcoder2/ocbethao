# Ocbethao Schema v1.5

Scope: single-restaurant first. This is not the final multi-tenant product schema.

Primary goals:
- stop daily menu data from growing for no business reason
- make stock changes traceable
- keep admin UI and current API shape mostly stable
- avoid rewriting the customer/admin frontend before the business flow is stable

Non-goals for v1.5:
- multi-tenant
- billing / plans
- full catalog / warehouse rewrite
- removing all legacy daily menu tables in one shot

## 1. Current schema pain points

Current source: `api/prisma/schema.prisma`

The real growth and audit problems are:

1. `DailyStockPool`
   Every day can clone many ingredient rows even when most are inactive or zero.

2. `DailyMenuItem`
   Per-day item rows repeat catalog data even when only a few items are enabled or changed.

3. `DailyMenuItemStock`
   This multiplies fast: `day x enabled item x pool link`.

4. `DailyStockPool.soldQuantity`
   This is a mutable aggregate, not an event log. It is hard to answer:
   - which order consumed stock
   - which cancel/restore returned stock
   - why a pool is mismatched

5. `OrderItem`
   It snapshots item name and price, which is correct, but it does not snapshot exact stock consumption.
   If day-level mappings change later, stock tracing becomes weak.

Important note:
- enum columns like `PAID`, `UNPAID`, `CONFIRMED`, `WAITING` are not the real storage problem.
- do not spend effort replacing enums with numeric codes in v1.5.

## 2. v1.5 strategy

Keep the current app mental model:
- `Kho hom nay`
- `Mon ban hom nay`
- `Luu thay doi`
- `Dang menu`

Keep the current top-level API response shape where possible:
- daily menu detail still returns `stockPools` and `items`
- orders still return `itemProgress`, `waitingQuantity`, `cookingQuantity`, `readyQuantity`, `cancelledQuantity`

But change the backend source of truth in two ways:

1. Daily menu data becomes sparse.
2. Stock changes become event-based.

## 3. Table policy

### 3.1 Keep as-is

These tables are still valid and should remain:

- `Ingredient`
- `MenuItem`
- `MenuItemPrice`
- `MenuItemIngredientPreset`
- `DailyMenu`
- `Order`
- `OrderItem`

### 3.2 Keep, but change behavior

These tables stay in v1.5, but save/load behavior changes:

#### `DailyStockPool`

Keep columns:
- `id`
- `dailyMenuId`
- `ingredientId`
- `label`
- `quantity`
- `soldQuantity`
- `isAvailable`
- `note`
- timestamps

New interpretation in v1.5:
- `quantity` = allocated quantity for that service day
- `soldQuantity` = cached aggregate for fast reads during transition
- source of truth for stock history is no longer only `soldQuantity`

Sparse save rule:
- only persist rows where at least one condition is true:
  - `isAvailable = true`
  - `quantity > 0`
  - `soldQuantity > 0`
  - linked by at least one enabled `DailyMenuItemStock`

Delete rule:
- if a pool has `soldQuantity = 0` and no active links, it can be deleted
- otherwise disable it with `isAvailable = false`

#### `DailyMenuItem`

Keep columns:
- `id`
- `dailyMenuId`
- `menuItemId`
- `overridePrice`
- `isAvailable`
- `highlightLabel`
- timestamps

Sparse save rule:
- only persist rows where at least one condition is true:
  - item is enabled for the day
  - `overridePrice` differs from the current catalog price
  - `highlightLabel` is not empty
  - item already has order references

Delete rule:
- if no order references exist and item is back to default state, delete the row
- if order references exist, keep row and set `isAvailable = false`

#### `DailyMenuItemStock`

Keep columns:
- `id`
- `dailyMenuItemId`
- `dailyStockPoolId`
- `consumeQuantity`
- `createdAt`

Behavior change:
- only persist for rows that actually exist in sparse `DailyMenuItem`
- no need to clone links for catalog items that are not enabled that day

### 3.3 Add new tables

These are the core v1.5 additions.

## 4. New tables

### 4.1 `InventoryMovement`

Purpose:
- event log for all stock changes that affect service-day pools
- answer "why did this pool go up/down"

Recommended enum:

```prisma
enum InventoryMovementType {
  MENU_POOL_INCREASE
  MENU_POOL_DECREASE
  ORDER_RESERVE
  ORDER_RELEASE
  ORDER_RESTORE
  MANUAL_ADJUST
  CORRECTION
}
```

Recommended table:

```prisma
model InventoryMovement {
  id               Int                   @id @default(autoincrement())
  ingredientId     Int
  dailyMenuId      Int?
  dailyStockPoolId Int?
  orderId          Int?
  orderItemId      Int?
  movementType     InventoryMovementType
  quantityDelta    Decimal               @db.Decimal(10, 2)
  note             String?               @db.LongText
  createdById      Int?
  createdAt        DateTime              @default(now())

  ingredient       Ingredient            @relation(fields: [ingredientId], references: [id], onDelete: Restrict)
  dailyMenu        DailyMenu?            @relation(fields: [dailyMenuId], references: [id], onDelete: SetNull)
  dailyStockPool   DailyStockPool?       @relation(fields: [dailyStockPoolId], references: [id], onDelete: SetNull)
  order            Order?                @relation(fields: [orderId], references: [id], onDelete: SetNull)
  orderItem        OrderItem?            @relation(fields: [orderItemId], references: [id], onDelete: SetNull)
  createdBy        User?                 @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([ingredientId, createdAt])
  @@index([dailyStockPoolId, createdAt])
  @@index([orderItemId, createdAt])
  @@index([movementType, createdAt])
}
```

How to use it:
- admin increases a day pool -> add `MENU_POOL_INCREASE`
- admin decreases a day pool -> add `MENU_POOL_DECREASE`
- order creation or item add -> add `ORDER_RESERVE`
- order/item cancel -> add `ORDER_RELEASE`
- item restore -> add `ORDER_RESTORE`
- manual fix -> add `MANUAL_ADJUST` or `CORRECTION`

### 4.2 `OrderItemConsumption`

Purpose:
- snapshot exactly which ingredient/pool an order item consumed
- keep tracing valid even if daily menu links change later

Recommended table:

```prisma
model OrderItemConsumption {
  id                  Int               @id @default(autoincrement())
  orderItemId         Int
  ingredientId        Int
  dailyStockPoolId    Int?
  consumeQuantity     Decimal           @db.Decimal(10, 2)
  totalQuantity       Decimal           @db.Decimal(10, 2)
  inventoryMovementId Int?
  createdAt           DateTime          @default(now())

  orderItem           OrderItem         @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  ingredient          Ingredient        @relation(fields: [ingredientId], references: [id], onDelete: Restrict)
  dailyStockPool      DailyStockPool?   @relation(fields: [dailyStockPoolId], references: [id], onDelete: SetNull)
  inventoryMovement   InventoryMovement? @relation(fields: [inventoryMovementId], references: [id], onDelete: SetNull)

  @@index([orderItemId])
  @@index([dailyStockPoolId])
  @@index([inventoryMovementId])
}
```

Meaning:
- `consumeQuantity` = per unit usage at the time of order
- `totalQuantity` = actual reserved amount for this order item row

This table makes debugging possible:
- which pool supplied the stock
- how much was reserved
- which movement row wrote it

## 5. Optional table for later, not required in v1.5

Do not add this yet unless the restaurant starts needing full warehouse management:

```text
InventoryBalance
- ingredientId PK
- onHandQuantity
- updatedAt
```

Why optional:
- current business flow is still centered on "today's pool", not a full warehouse ledger
- `InventoryMovement + DailyStockPool` is enough for v1.5

## 6. Resulting table map

### Keep

```text
Ingredient
MenuItem
MenuItemPrice
MenuItemIngredientPreset
DailyMenu
Order
OrderItem
```

### Keep but sparse / cached

```text
DailyStockPool
DailyMenuItem
DailyMenuItemStock
```

### Add

```text
InventoryMovement
OrderItemConsumption
```

## 7. Read/write rules in v1.5

### Daily menu save

Controller impacted:
- `DailyMenusController`

New save policy:
- build sparse payload for `stockPools`
- build sparse payload for `items`
- upsert only meaningful daily rows
- delete or disable empty rows with no history

Frontend impact:
- minimal
- current `DailyMenus.vue` can still edit all ingredients/items in memory
- filtering to sparse persistence should happen in backend or in the save payload builder

### Order create / update / cancel / restore

Controller impacted:
- `OrdersController`

New write policy:
- still update `DailyStockPool.soldQuantity` during transition for fast compatibility
- also write one or more `InventoryMovement` rows
- also write `OrderItemConsumption` rows when a reservation is created or changed

Transition rule:
- `soldQuantity` becomes a cache
- `InventoryMovement` becomes the audit source

## 8. Migration phases

### Phase 1: Add audit tables, no FE break

Do first:
- add `InventoryMovement`
- add `OrderItemConsumption`
- keep all current daily menu tables
- keep writing `soldQuantity`
- dual-write movement rows from order flows

Expected frontend change:
- none required

### Phase 2: Sparse daily menu persistence

Do next:
- change daily menu save logic to only persist meaningful `stockPools`
- change daily menu save logic to only persist meaningful `items`
- keep current detail response shape by reconstructing from:
  - catalog
  - sparse overrides
  - current daily rows

Expected frontend change:
- very small or none

### Phase 3: Backfill and cleanup

Do after Phase 1 and 2 are stable:
- backfill `InventoryMovement` from recent order history if needed
- backfill `OrderItemConsumption` only if worth the effort
- mark `DailyStockPool.soldQuantity` as cache in code comments and docs

Not required yet:
- removing `soldQuantity`
- renaming `DailyMenu*` tables
- building a warehouse module

## 9. Concrete implementation order for this repo

Recommended sequence:

1. Prisma schema migration
   - add `InventoryMovementType`
   - add `InventoryMovement`
   - add `OrderItemConsumption`

2. Order service dual-write
   - create order
   - update order quantity
   - cancel order
   - cancel item
   - restore item

3. Daily menu sparse save
   - filter `stockPools`
   - filter `items`
   - only keep rows with business meaning

4. Daily menu sparse read
   - keep FE contract
   - rebuild complete workspace on read using catalog + sparse day data

5. Reporting / admin debug
   - add a simple admin query later:
     - by pool
     - by order item
     - by date range

## 10. What v1.5 solves

It solves:
- daily menu row growth that does not add business value
- stock traceability
- order-to-stock audit
- most "why is stock wrong" debugging pain

It does not solve yet:
- multi-tenant
- branch-level stock
- purchasing / supplier receiving
- full productization

## 11. Why this is the right level for Ocbethao now

This project is still validating the restaurant workflow.

So the best tradeoff is:
- do not keep patching the old daily snapshot model forever
- do not do a massive product-platform rewrite yet

v1.5 is the middle path:
- enough cleanup to stop bad data growth
- enough audit to trust stock again
- small enough to ship while the restaurant is still actively using and shaping the app


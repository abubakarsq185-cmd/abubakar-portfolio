-- ===========================================================================
-- 0006_nutrition.sql
-- Non-medical nutrition guidance: targets with guard rails, plate-based
-- alternatives, Pakistani food catalogue, recipes, meal plans and logging.
--
-- Safety: calorie targets are clamped by application-level guard rails
-- (packages/domain/src/nutrition) AND by the CHECK constraints below. The
-- product never produces medical nutrition therapy.
-- ===========================================================================

create table food_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  code              citext not null,
  name              text not null,
  name_ur           text,
  name_ur_rm        text,
  category          text not null default 'other'
                      check (category in ('grain','roti_bread','lentil','meat','poultry','fish','egg','dairy','vegetable','fruit','nut_seed','oil_fat','sweet','beverage','snack','composite','other')),
  serving_label     text not null,
  serving_grams     numeric(7,2) not null check (serving_grams > 0),
  calories_kcal     numeric(7,2) not null check (calories_kcal >= 0),
  protein_g         numeric(6,2) not null default 0,
  carbs_g           numeric(6,2) not null default 0,
  fat_g             numeric(6,2) not null default 0,
  fibre_g           numeric(6,2) not null default 0,
  is_halal          boolean not null default true,
  is_vegetarian     boolean not null default false,
  is_local_staple   boolean not null default false,
  typical_cost_band text check (typical_cost_band in ('low','medium','high')),
  allergens         text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index food_items_platform_code_key on food_items (code) where organization_id is null;
create unique index food_items_org_code_key on food_items (organization_id, code) where organization_id is not null;
create index food_items_search_idx on food_items (category, name);

-- Cheaper / more available swaps, e.g. beef mince → chicken mince → daal.
create table food_substitutions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  food_item_id      uuid not null references food_items(id) on delete cascade,
  alternative_food_item_id uuid not null references food_items(id) on delete cascade,
  reason            text not null default 'availability'
                      check (reason in ('availability','budget','preference','allergen','vegetarian','higher_protein')),
  note              text,
  unique (food_item_id, alternative_food_item_id, reason),
  constraint food_substitution_distinct check (food_item_id <> alternative_food_item_id)
);

create table recipes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  created_by_user_id uuid references users(id) on delete set null,
  code              citext,
  name              text not null,
  name_ur           text,
  description       text,
  servings          numeric(4,1) not null default 1 check (servings > 0),
  prep_minutes      integer not null default 10,
  cook_minutes      integer not null default 15,
  method_steps      text[] not null default '{}',
  meal_slot         text check (meal_slot in ('breakfast','lunch','dinner','snack','pre_workout','post_workout','sehri','iftar')),
  is_halal          boolean not null default true,
  is_vegetarian     boolean not null default false,
  cost_band         text check (cost_band in ('low','medium','high')),
  image_url         text,
  visibility        text not null default 'organization' check (visibility in ('platform','organization','member')),
  calories_kcal     numeric(7,2),
  protein_g         numeric(6,2),
  carbs_g           numeric(6,2),
  fat_g             numeric(6,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index recipes_org_idx on recipes (organization_id) where deleted_at is null;

create table recipe_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references organizations(id) on delete cascade,
  recipe_id         uuid not null references recipes(id) on delete cascade,
  food_item_id      uuid not null references food_items(id) on delete restrict,
  quantity_servings numeric(6,2) not null default 1 check (quantity_servings > 0),
  note              text,
  position          integer not null default 0
);
create index recipe_items_recipe_idx on recipe_items (recipe_id);

create table nutrition_targets (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  user_id               uuid not null references users(id) on delete cascade,
  approach              text not null default 'plate'
                          check (approach in ('plate','macros','calories_only')),
  goal                  training_goal not null,
  -- Guard rails: no extreme deficits. Enforced again in the domain layer.
  calories_kcal         integer check (calories_kcal is null or calories_kcal between 1200 and 5000),
  protein_g             integer check (protein_g is null or protein_g between 20 and 400),
  carbs_g               integer check (carbs_g is null or carbs_g between 30 and 700),
  fat_g                 integer check (fat_g is null or fat_g between 20 and 250),
  fibre_g               integer,
  water_ml              integer not null default 2500,
  protein_palms         numeric(3,1),
  carb_cupped_hands     numeric(3,1),
  veg_fists             numeric(3,1),
  fat_thumbs            numeric(3,1),
  weekly_change_kg      numeric(4,2) check (weekly_change_kg is null or weekly_change_kg between -1.0 and 1.0),
  dietary_preferences   text[] not null default '{}',
  allergies             text[] not null default '{}',
  halal_only            boolean not null default true,
  budget_band           text check (budget_band in ('low','medium','high')),
  ramadan_schedule      boolean not null default false,
  set_by_user_id        uuid references users(id) on delete set null,
  set_by_role           role_code,
  guard_rail_notes      text,
  effective_from        date not null default current_date,
  superseded_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index nutrition_targets_user_idx on nutrition_targets (user_id, effective_from desc);
create unique index nutrition_targets_current on nutrition_targets (user_id) where superseded_at is null;

create table meal_plans (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid references users(id) on delete cascade,
  name              text not null,
  summary           text,
  goal              training_goal,
  approach          text not null default 'plate' check (approach in ('plate','macros','calories_only')),
  is_template       boolean not null default false,
  ramadan_variant   boolean not null default false,
  approved_by       uuid references users(id) on delete set null,
  approved_at       timestamptz,
  state             publish_state not null default 'published',
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint meal_plan_owner check (is_template or user_id is not null)
);
create index meal_plans_user_idx on meal_plans (user_id) where user_id is not null;

create table meal_plan_entries (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  meal_plan_id      uuid not null references meal_plans(id) on delete cascade,
  day_number        integer not null check (day_number between 1 and 7),
  meal_slot         text not null check (meal_slot in ('breakfast','lunch','dinner','snack','pre_workout','post_workout','sehri','iftar')),
  recipe_id         uuid references recipes(id) on delete set null,
  food_item_id      uuid references food_items(id) on delete set null,
  quantity_servings numeric(6,2) not null default 1,
  guidance_text     text,
  position          integer not null default 0,
  constraint meal_plan_entry_content check (recipe_id is not null or food_item_id is not null or guidance_text is not null)
);
create index meal_plan_entries_plan_idx on meal_plan_entries (meal_plan_id, day_number);

create table meal_logs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  logged_on         date not null default current_date,
  meal_slot         text not null check (meal_slot in ('breakfast','lunch','dinner','snack','pre_workout','post_workout','sehri','iftar')),
  recipe_id         uuid references recipes(id) on delete set null,
  food_item_id      uuid references food_items(id) on delete set null,
  free_text         text,
  quantity_servings numeric(6,2) not null default 1,
  calories_kcal     numeric(7,2),
  protein_g         numeric(6,2),
  carbs_g           numeric(6,2),
  fat_g             numeric(6,2),
  plate_rating      integer check (plate_rating between 1 and 5),
  photo_storage_key text,
  logged_via        text not null default 'app' check (logged_via in ('app','web','coach','import')),
  created_at        timestamptz not null default now(),
  constraint meal_log_content check (recipe_id is not null or food_item_id is not null or free_text is not null)
);
create index meal_logs_user_day_idx on meal_logs (user_id, logged_on desc);

create table grocery_lists (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  meal_plan_id      uuid references meal_plans(id) on delete set null,
  week_starting     date not null default current_date,
  items             jsonb not null default '[]'::jsonb,
  estimated_cost_minor bigint,
  currency          char(3) not null default 'PKR',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, week_starting)
);

select app.attach_touch(t) from (values
  ('food_items'::regclass), ('recipes'), ('nutrition_targets'), ('meal_plans'), ('grocery_lists')
) as v(t);

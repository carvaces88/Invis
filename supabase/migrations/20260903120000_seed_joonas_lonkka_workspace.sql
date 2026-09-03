-- Seed Joonas (Ravintola Lonkka) cloud workspace for phone + web sync.
-- Gate login: "joonas" (no email). Sync key: joonas@invis.app
-- Places: 1 fridge + 1 freezer (editable in-app via More → Places).

insert into public.workspace_snapshots as w (
  workspace_key,
  email,
  venue,
  payload,
  updated_at
)
values (
  'joonas@invis.app',
  'joonas@invis.app',
  'Ravintola Lonkka',
  jsonb_build_object(
    'customProducts', '[]'::jsonb,
    'aliasExtras', '{}'::jsonb,
    'packExtras', '{}'::jsonb,
    'catalogFieldExtras', '{}'::jsonb,
    'lastRecordUnit', '"KPL"',
    'recentActivity', '[]'::jsonb,
    'inventoryCleared', true,
    'siteName', 'Ravintola Lonkka',
    'activePlaceId', 'place-lonkka-fridge',
    'periodSnapshot', null,
    'priorStockList', null,
    'inventoryPhotos', '[]'::jsonb,
    'places', jsonb_build_array(
      jsonb_build_object(
        'id', 'place-lonkka-fridge',
        'name', 'Fridge',
        'kind', 'kitchen',
        'storageType', 'prep_fridge',
        'sortOrder', 0
      ),
      jsonb_build_object(
        'id', 'place-lonkka-freezer',
        'name', 'Freezer',
        'kind', 'freezer',
        'storageType', 'freezer',
        'sortOrder', 1
      )
    ),
    'session', jsonb_build_object(
      'id', 'session-lonkka-seed',
      'title', 'Inventory sheet RR',
      'date', to_char(timezone('utc', now()), 'YYYY-MM-DD'),
      'status', 'in_progress',
      'lines', '[]'::jsonb
    )
  ),
  now()
)
on conflict (workspace_key) do update
set
  email = excluded.email,
  venue = excluded.venue,
  -- Keep an already-customized live workspace; only fill if missing keys.
  payload = case
    when w.payload ? 'places'
      and jsonb_typeof(w.payload->'places') = 'array'
      and jsonb_array_length(w.payload->'places') > 0
    then w.payload
    else excluded.payload
  end,
  updated_at = case
    when w.payload ? 'places'
      and jsonb_typeof(w.payload->'places') = 'array'
      and jsonb_array_length(w.payload->'places') > 0
    then w.updated_at
    else excluded.updated_at
  end;

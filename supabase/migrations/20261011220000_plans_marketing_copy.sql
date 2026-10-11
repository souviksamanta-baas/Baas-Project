-- Marketing copy for /comenzar plan cards (editable from admin /planes).
alter table public.plans
  add column if not exists marketing jsonb not null default '{}'::jsonb;

-- Align commercial catalog with /comenzar: Básico, Pro, Enterprise.
update public.plans
set
  price_ars_monthly = 65000,
  price_ars_annual = 715000,
  sort_order = 20,
  marketing = jsonb_build_object(
    'tagline', 'Hasta 5 usuarios · 1 sucursal',
    'featured', true,
    'servicios', jsonb_build_array('Comercio', 'Facturación', 'Agenda', 'Canales'),
    'copi', jsonb_build_array('Copi básico (5 preguntas preconfiguradas)')
  ),
  updated_at = now()
where slug = 'basico';

update public.plans
set
  price_ars_monthly = 85000,
  price_ars_annual = 935000,
  sort_order = 30,
  marketing = jsonb_build_object(
    'tagline', 'Hasta 5 usuarios · 1 sucursal',
    'featured', false,
    'servicios', jsonb_build_array('Comercio', 'Facturación', 'Agenda', 'Canales'),
    'copi', jsonb_build_array(
      'Crear tareas, turnos y otras acciones automáticamente',
      'Entradas y respuestas por voz',
      'Reportes personalizados',
      'Análisis de imágenes'
    )
  ),
  updated_at = now()
where slug = 'pro';

update public.plans
set
  price_ars_monthly = 0,
  price_ars_annual = 0,
  sort_order = 40,
  marketing = jsonb_build_object(
    'tagline', 'Usuarios ilimitados · Multisucursal',
    'featured', false,
    'customPriceLabel', 'Precio a medida',
    'servicios', jsonb_build_array(
      'Comercio',
      'Facturación',
      'Agenda',
      'Canales',
      'Multisucursal',
      'Usuarios ilimitados'
    ),
    'copi', jsonb_build_array(
      'Crear tareas, turnos y otras acciones automáticamente',
      'Entradas y respuestas por voz',
      'Reportes personalizados',
      'Análisis de imágenes'
    )
  ),
  updated_at = now()
where slug = 'enterprise';

-- Keep starter in DB for legacy orgs, but out of the commercial catalog.
update public.plans
set
  is_active = false,
  updated_at = now()
where slug = 'starter';

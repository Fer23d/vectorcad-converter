create table if not exists public.academy_modules (
  id text primary key,
  sequence integer not null unique,
  code text not null,
  title text not null,
  summary text not null,
  is_active boolean not null default true,
  required_plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_steps (
  id text primary key,
  module_id text not null references public.academy_modules(id) on delete cascade,
  sequence integer not null,
  title text not null,
  objective text not null,
  description text not null,
  media_type text not null default 'video',
  media_url text,
  article_url text,
  checklist jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, sequence)
);

create table if not exists public.user_academy_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  completed_steps text[] not null default '{}',
  current_step_id text references public.academy_steps(id) on delete set null,
  certificate_issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_steps_module_idx
  on public.academy_steps (module_id, sequence);

create index if not exists user_academy_progress_user_id_idx
  on public.user_academy_progress (user_id);

alter table public.academy_modules enable row level security;
alter table public.academy_steps enable row level security;
alter table public.user_academy_progress enable row level security;

drop policy if exists "Authenticated users can read active academy modules" on public.academy_modules;
create policy "Authenticated users can read active academy modules"
  on public.academy_modules
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "Authenticated users can read active academy steps" on public.academy_steps;
create policy "Authenticated users can read active academy steps"
  on public.academy_steps
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "Users can read their own academy progress" on public.user_academy_progress;
create policy "Users can read their own academy progress"
  on public.user_academy_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own academy progress" on public.user_academy_progress;
create policy "Users can create their own academy progress"
  on public.user_academy_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own academy progress" on public.user_academy_progress;
create policy "Users can update their own academy progress"
  on public.user_academy_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.academy_modules (id, sequence, code, title, summary)
values
  ('fundamentos-vetorcad', 1, '01', 'Fundamentos do VetorCAD', 'Entenda a lógica do workspace, projetos e fluxo técnico da plataforma.'),
  ('importacao-arquivos', 2, '02', 'Importação de arquivos', 'Prepare imagens e PDFs técnicos para processamento CAD.'),
  ('vetorizacao', 3, '03', 'Vetorização', 'Transforme imagens técnicas em elementos vetoriais editáveis.'),
  ('ajustes-edicao', 4, '04', 'Ajustes e edição', 'Revise o resultado e prepare o documento para uso profissional.'),
  ('exportacao-dxf-svg', 5, '05', 'Exportação DXF/SVG', 'Gere arquivos compatíveis com CAD, CNC e fluxos técnicos.'),
  ('fluxo-profissional', 6, '06', 'Fluxo profissional', 'Combine importação, vetorização, revisão e exportação em uma rotina confiável.')
on conflict (id) do update
set sequence = excluded.sequence,
    code = excluded.code,
    title = excluded.title,
    summary = excluded.summary,
    updated_at = now();

insert into public.academy_steps (id, module_id, sequence, title, objective, description, media_type, checklist)
values
  ('fundamentos-interface', 'fundamentos-vetorcad', 1, 'Interface profissional do VetorCAD', 'Reconhecer as áreas principais do editor e do painel SaaS.', 'Conheça a separação entre projetos, editor CAD, perfil, processamento e exportação para trabalhar com menos tentativa e erro.', 'video', '["Identificar painel esquerdo","Localizar área central de preview","Localizar exportações e perfil"]'::jsonb),
  ('fundamentos-projeto', 'fundamentos-vetorcad', 2, 'Projetos e persistência', 'Entender quando um documento está salvo e pronto para continuar depois.', 'Veja como criar projetos, salvar alterações e evitar abrir fluxos avançados antes da persistência ser concluída.', 'image', '["Criar um projeto","Verificar status salvo","Abrir projeto existente"]'::jsonb),
  ('importacao-formatos', 'importacao-arquivos', 1, 'Formatos aceitos', 'Escolher o arquivo correto para obter melhor qualidade de vetorização.', 'Entenda quando usar PNG, JPG, WEBP, TIFF ou PDF e como a primeira página do PDF entra no pipeline de imagem.', 'video', '["Identificar formato do arquivo","Enviar PDF técnico","Confirmar preview processado"]'::jsonb),
  ('importacao-qualidade', 'importacao-arquivos', 2, 'Qualidade de entrada', 'Avaliar nitidez, contraste e resolução antes da conversão.', 'Aprenda a reconhecer arquivos adequados para CAD e quando usar melhoria de imagem antes da vetorização.', 'image', '["Conferir linhas finas","Avaliar contraste","Usar melhoria quando necessário"]'::jsonb),
  ('vetorizacao-contornos', 'vetorizacao', 1, 'Contornos e precisão', 'Converter linhas e formas em caminhos vetoriais com controle técnico.', 'Veja como os contornos são extraídos e como ajustes de precisão impactam o resultado final.', 'video', '["Gerar contornos","Comparar preview vetorial","Ajustar precisão"]'::jsonb),
  ('vetorizacao-limpeza', 'vetorizacao', 2, 'Limpeza de ruído', 'Reduzir interferências sem perder informação técnica importante.', 'Aprenda a interpretar ruído, linhas quebradas e excesso de pontos durante a conversão.', 'image', '["Identificar ruídos","Reprocessar com ajustes","Validar caminhos gerados"]'::jsonb),
  ('ajustes-camadas', 'ajustes-edicao', 1, 'Camadas e leitura técnica', 'Organizar o resultado por camadas e reconhecer informações úteis.', 'Entenda como os dados do documento ajudam a validar o resultado antes da exportação.', 'video', '["Abrir layers","Revisar resumo do vetor","Checar pontos editáveis"]'::jsonb),
  ('exportacao-formatos', 'exportacao-dxf-svg', 1, 'Escolhendo DXF ou SVG', 'Exportar o formato adequado ao seu fluxo profissional.', 'Compare DXF, SVG e PDF visual para escolher a saída correta sem misturar raster e vetor.', 'video', '["Exportar SVG","Exportar DXF","Validar arquivo gerado"]'::jsonb),
  ('fluxo-operacional', 'fluxo-profissional', 1, 'Rotina completa de conversão', 'Executar um fluxo profissional de ponta a ponta.', 'Consolide os passos anteriores em um processo repetível para plantas, desenhos mecânicos e arquivos de fabricação.', 'video', '["Importar arquivo","Processar imagem","Vetorizar","Exportar resultado"]'::jsonb)
on conflict (id) do update
set module_id = excluded.module_id,
    sequence = excluded.sequence,
    title = excluded.title,
    objective = excluded.objective,
    description = excluded.description,
    media_type = excluded.media_type,
    checklist = excluded.checklist,
    updated_at = now();

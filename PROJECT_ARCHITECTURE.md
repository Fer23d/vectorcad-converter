# Relatório Técnico de Arquitetura — VectorCAD

> Documento de transferência técnica para análise e refatoração.
>
> Snapshot auditado: branch `main`, commit `853b2154dba1c345694a62fbafd5ed1dfdc96ac3`.

## 1. Visão Geral da Arquitetura

### 1.1 Resumo

O projeto é um SaaS de conversão de imagens e desenhos técnicos para formatos vetoriais CAD. A aplicação combina:

- páginas públicas e institucionais;
- autenticação e confirmação de e-mail com Supabase Auth;
- workspace autenticado para projetos;
- editor de imagem, vetorização, exportação SVG/DXF e visualização 3D;
- OCR local com Tesseract.js;
- pipeline de análise técnica híbrida com OCR, Vision Provider, TextFusion, reconhecimento de elementos e cotas;
- billing por Mercado Pago;
- envio de e-mails transacionais por Resend;
- persistência principal em Supabase e rascunho temporário por usuário no `localStorage`.

O frontend usa principalmente estado local de React. Não há Zustand, Redux ou Context global para o editor. O `SaasDashboard` funciona como orquestrador de sessão, projetos e abas, enquanto `VectorCadApp` concentra o estado operacional do editor.

### 1.2 Stack principal

| Camada | Tecnologia | Uso |
|---|---|---|
| Framework | Next.js 16 App Router | Rotas, Server Components, Client Components e API Routes |
| UI | React 19 + TypeScript | Componentes e estado da interface |
| Estilos | Tailwind CSS 3 + CSS Modules pontuais | Tema dark, layout responsivo e estilos específicos |
| Ícones | `lucide-react` | Ícones de ações, navegação e estados |
| Backend/BaaS | Supabase JS 2 | Auth, Postgres, RLS e Storage/integrações de dados |
| OCR | Tesseract.js 7 | Reconhecimento local de textos |
| TIFF | UTIF 3 | Decodificação TIFF e conversão para RGBA/preview PNG |
| Imagem server-side | Sharp | Enhance e processamento protegido no backend |
| Vetorização | Implementação própria em `lib/vectorize` | Contornos, paths, escala e geometria |
| Limpeza vetorial | Implementação própria | Douglas-Peucker, junção e deduplicação de linhas |
| 3D | Three.js | Visualização 3D de documentos SVG/CAD |
| DXF | `dxf-writer`, `dxf` e tipos locais | Geração de entidades DXF, inclusive textos inteligentes |
| SVG | Exportador próprio | Serialização de paths e documentos vetoriais |
| E-mail | Resend + React Email | Welcome, confirmação, reset, pagamento e limite |
| Pagamento | API Mercado Pago | Checkout, status e webhook de pagamentos |
| Testes | Vitest | Testes unitários de domínio, imagem, OCR, IA e exportação |
| Deploy | Vercel | Build Next.js e produção por `main` |

### 1.3 `package.json` e dependências

Arquivo: `package.json`.

#### Dependências de produção

```text
@react-email/components   Templates React Email
@supabase/supabase-js     Cliente Supabase/Auth
dxf-writer                Escrita de entidades DXF
lucide-react              Ícones
next                      Framework web
react / react-dom         Runtime da interface
resend                    Envio de e-mails
sharp                     Processamento de imagem no servidor
tesseract.js              OCR local
three                     Visualizador 3D
utif                      Leitura de TIFF
```

#### Dependências de desenvolvimento

```text
@eslint/eslintrc, eslint, eslint-config-next  Lint
@types/node, @types/react, @types/react-dom, @types/three  Tipos TypeScript
autoprefixer, postcss, tailwindcss             Pipeline CSS
dxf, dxf-parser                                Tipos/parsers auxiliares DXF
pg                                             Integrações SQL/DB auxiliares
typescript                                     Compilação e tipagem
vitest                                         Testes unitários
```

Scripts relevantes:

- `npm run dev`: servidor local Next.js.
- `npm run build`: executa `scripts/verify-public-env.mjs` e depois `next build`.
- `npm run start`: servidor de produção local.
- `npm run lint`: `eslint .`.
- `npm test`: `vitest run`.
- `npm run admin:create`: cria ou atualiza o administrador via service role.

### 1.4 Configuração de compilação e deploy

- `tsconfig.json`: TypeScript estrito, `moduleResolution: bundler`, JSX `react-jsx`, alias `@/*` apontando para a raiz.
- `next-env.d.ts`: tipos gerados pelo Next.js.
- `tailwind.config.ts`, `postcss.config.js`: configuração do Tailwind/PostCSS.
- `vercel.json`: framework `nextjs`, instalação por `npm ci` e build por `npm run build`.
- `scripts/verify-public-env.mjs`: valida a configuração pública necessária durante o build.

## 2. Estrutura de Pastas e Arquivos

Árvore resumida dos módulos de maior relevância:

```text
.
├── app/
│   ├── page.tsx                         Landing page pública
│   ├── layout.tsx                       Layout, metadata e shell global
│   ├── globals.css                      Estilos globais
│   ├── login/page.tsx                   Login
│   ├── signup/page.tsx                  Cadastro
│   ├── dashboard/page.tsx               Workspace autenticado
│   ├── editor/page.tsx                  Editor protegido independente
│   ├── reset-password/page.tsx          Redefinição de senha
│   ├── verify-email/page.tsx            Confirmação de e-mail
│   ├── admin/page.tsx                   Painel administrativo
│   ├── pricing/page.tsx                 Planos
│   ├── blog/                            Blog e artigos
│   ├── sobre/page.tsx                   Página institucional
│   ├── contato/page.tsx                 Contato
│   ├── termos*/                         Termos de uso
│   ├── privacidade*/                    Política de privacidade
│   ├── projetos/[id]/3d/page.tsx        Visualizador 3D independente
│   └── api/                             Rotas server-side
│       ├── auth/                        Cadastro e confirmação
│       ├── admin/                       Operações administrativas
│       ├── ai/vision/                   Gateway Vision AI
│       ├── email/                       E-mails transacionais
│       ├── export/                      SVG e DXF
│       ├── image/enhance/               Enhance server-side
│       ├── payment/                     Mercado Pago
│       ├── process/                     Processamento de imagem
│       ├── profile/                     Perfil
│       ├── usage/                       Limite diário
│       ├── upload/                      Upload
│       └── vectorize/                   Vetorização
├── components/
│   ├── vector-cad-app.tsx               Editor principal
│   ├── saas-dashboard.tsx               Orquestrador do workspace
│   ├── auth-form.tsx                    Login/cadastro
│   ├── protected-editor.tsx             Guarda do editor independente
│   ├── protected-project-3d-viewer.tsx Guarda do visualizador 3D
│   ├── SvgTo3DCadViewer.tsx             Visualizador Three.js
│   ├── admin-dashboard.tsx              UI do admin
│   ├── reset-password-form.tsx          Fluxo de recovery
│   ├── verify-email-panel.tsx           Confirmação de e-mail
│   ├── public-site-shell.tsx            Shell público/footer
│   ├── public-hero-elegant.tsx          Hero público
│   ├── landing-section.tsx              Seções públicas
│   ├── feature-card.tsx                 Cards de benefícios
│   ├── faq-section.tsx                  FAQ interativo
│   ├── pricing-page.tsx                 UI de planos
│   ├── onboarding-*.tsx                 Onboarding e checklist
│   ├── usage-meter.tsx                  Indicador de uso
│   └── hooks/
│       ├── use-local-project-draft.ts   Rascunho por usuário
│       ├── use-zoom-pan.ts              Zoom/pan
│       └── use-resizable-panel.ts       Painéis redimensionáveis
├── lib/
│   ├── supabase/                        Clientes browser/server/admin
│   ├── access-control.ts                Regras de plano e capacidade
│   ├── effective-plan.ts                Plano efetivo server-side
│   ├── admin.ts, admin-auth.ts          Roles e proteção administrativa
│   ├── billing.ts, mercadopago.ts       Billing e Mercado Pago
│   ├── resend.ts                         Serviço de e-mails
│   ├── image-processing/                TIFF, pixels, Enhance e CAD Clean
│   ├── text-detection/ocr.ts            OCR Tesseract
│   ├── ai/                              IA híbrida e fusão de resultados
│   ├── vectorize/                       Raster para paths/documento CAD
│   ├── vector/                          Inteligência e limpeza de linhas
│   └── exporters/                       SVG e DXF
├── emails/                              Templates React Email
├── types/                               Contratos de domínio e declarações
├── supabase/                            SQL, schemas e migrations
├── scripts/                             Verificação de env e administração
├── tests/                               Testes Vitest
├── public/                              Ícones, logo e ads.txt
└── package.json / vercel.json            Tooling e deploy
```

## 3. Mapeamento de Componentes da Interface do Editor

### 3.1 Composição de rotas

```text
/dashboard
  app/dashboard/page.tsx
    └── SaasDashboard
          └── VectorCadApp (aba Editor)

/editor
  app/editor/page.tsx
    └── ProtectedEditor
          └── VectorCadApp

/projetos/[id]/3d
  app/projetos/[id]/3d/page.tsx
    └── ProtectedProject3DViewer
          └── SvgTo3DCadViewer
```

### 3.2 Editor principal

O componente `components/vector-cad-app.tsx` é um editor monolítico de alto acoplamento funcional. Ele contém o estado, os handlers, a renderização da interface e boa parte das funções auxiliares de overlay.

| Área visual | Responsável | Responsabilidades |
|---|---|---|
| Header do editor | `VectorCadApp` | Nome/estado do projeto, ações de salvar, exportar, abrir 3D e estado de processamento |
| Sidebar de pré-processamento | `VectorCadApp` + `Section` local | Seleção de Original, Melhorada, Ultra CAD Pro, CAD Clean, AI Enhance e modos relacionados |
| Upload | `VectorCadApp` | Input/drag-and-drop, validação de tamanho/MIME, leitura raster e decodificação TIFF |
| Imagem de origem | `VectorCadApp` | Preview da imagem original/processada, canvas e visualizações de diagnóstico |
| Painel principal | `VectorCadApp` | Área de viewport com zoom/pan, canvas, SVG e overlays |
| Overlay OCR/IA | `AiAnalysisOverlay` local | Bounding boxes, tipo, confiança, origem, filtro de confiança e seleção |
| Overlay de cotas | `DimensionOverlay` local | Visualização de dimensões detectadas e detalhes selecionados |
| Overlay vetorial | `VectorInspectionOverlay` local | Inspeção de paths, pontos, layer e propriedades |
| Sidebar CAD | `VectorCadApp` + `Section` local | Unidade, largura/altura real, escala, modo de visualização e resumo do vetor |
| Exportações | `VectorCadApp` + `lib/exporters/*` | Download de SVG, DXF e imagem, respeitando uso/plano e textos inteligentes |
| VectorCAD AI | `VectorCadApp` | OCR, análise Vision, TextFusion, elementos, objetos, cotas, overlay e feedback |
| Uso e upgrade | `UsageMeter` + estado local | Limite diário, plano, bloqueios e CTA de upgrade |
| 3D | `SvgTo3DCadViewer` | Orbit/zoom/pan, layers, propriedades, medições e modo de nova guia |

### 3.3 Componentes adjacentes

- `components/saas-dashboard.tsx`: controla tabs `projects`, `editor` e `profile`, lista projetos, perfil, onboarding, exclusão e salvamento oficial.
- `components/protected-editor.tsx`: verifica configuração Supabase, sessão e confirmação de e-mail antes de renderizar o editor independente.
- `components/protected-project-3d-viewer.tsx`: busca o projeto pelo `id` e `user_id`, reconstrói o documento SVG e então monta o visualizador 3D.
- `components/onboarding-modal.tsx` e `components/onboarding-checklist.tsx`: primeiro acesso e progresso do usuário.
- `components/hooks/use-zoom-pan.ts`: comportamento de viewport, escala e deslocamento da área de visualização.
- `components/hooks/use-resizable-panel.ts`: largura de painéis laterais.

## 4. Estado Global e Fluxo de Dados

### 4.1 Modelo de estado

Não existe store global dedicado. O fluxo atual é:

```text
SaasDashboard
  ├── user/profile/projects/activeProject (useState)
  ├── saveProject / handleProjectChange (callbacks)
  └── VectorCadApp
        ├── sourceImage / processedImage / TIFF raster
        ├── processing/imageQuality/lineProcessingMode
        ├── vectorDocument / vector settings
        ├── OCR / AI / dimensions / feedback
        ├── camera/view/unit/dimensions
        └── draft local + onProjectChange(data)
```

`useRef` é usado em pontos sensíveis para evitar que callbacks assíncronos usem snapshots antigos. O `key={activeProject?.id || "empty-editor"}` no dashboard força a reconstrução do editor quando o projeto ativo muda.

### 4.2 Contrato persistido

O contrato principal está em `types/project.ts`, no tipo `CadProjectData`. O JSON do projeto pode conter:

- imagem original e imagem processada em Data URL;
- nome, extensão/formato e origem TIFF;
- configurações de processamento e qualidade;
- unidade, dimensões reais, escala e modo de visualização;
- `VectorDocument` com paths, layers e configurações;
- textos detectados e `aiAnalysis`;
- dimensões, objetos, elementos e `aiFeedback`;
- preferências de exportação e bloqueio.

O registro oficial está em `supabase/projects.sql`:

```text
projects
  id uuid
  user_id uuid -> auth.users(id)
  name text
  type text (2d/3d)
  data jsonb
  created_at timestamptz
  updated_at timestamptz
```

### 4.3 Upload e processamento

```text
File input / drop
  ├── valida tamanho (12 MB no editor)
  ├── valida MIME/extensão PNG/JPEG/WEBP/TIF/TIFF
  ├── TIFF -> processTiff -> RGBA -> preview PNG
  └── raster -> Image/Canvas -> Data URL
         ↓
   imagem original preservada
         ↓
   processPixels / CAD Clean / AI Enhance
         ↓
   regiões protegidas de texto quando aplicável
         ↓
   vectorizeBitmap
         ↓
   Line Intelligence
         ↓
   Vector Cleanup
         ↓
   VectorDocument
```

O editor mantém a imagem original separada da imagem processada. O navegador não renderiza TIFF diretamente; o fluxo usa a saída RGBA/PNG interna.

### 4.4 OCR e análise técnica

```text
Imagem processada / regiões
  ↓
Tesseract.js local (OCR direto e por regiões)
  ↓
normalização de candidatos
  ↓
Vision Provider por regiões suspeitas, quando habilitado
  ↓
TextFusionEngine
  ↓
classificação de textos
  ↓
VisionObjectDetector / ElementRecognitionEngine
  ↓
DimensionRecognitionEngine
  ↓
aiAnalysis persistida no projeto
```

O endpoint `app/api/ai/vision/route.ts` faz a ponte server-side, valida sessão bearer, limita regiões, chama OCR/Vision e retorna análise consolidada. A chave Vision não deve ser exposta ao client.

### 4.5 Rascunho local, auto-save e salvamento oficial

`components/hooks/use-local-project-draft.ts` usa a chave:

```text
currentProject-{userId}
```

Características:

- restaura o rascunho quando não há estado inicial equivalente;
- persiste após 60.000 ms sem alterações;
- mantém apenas um timer por usuário por meio de `pendingDraftTimers`;
- marca o estado como sujo;
- cancela o timer antes do salvamento oficial;
- limpa o rascunho somente depois de confirmação do `update` no Supabase.

O dashboard também possui um auto-save de backend com `BACKEND_AUTO_SAVE_DELAY_MS = 900`. Portanto, existem duas camadas distintas: rascunho local de 60 segundos e atualização de backend disparada pelo dashboard em aproximadamente 900 ms após alteração. Essa duplicidade deve ser considerada em qualquer refatoração para evitar requests excessivos ou corrida entre snapshots.

Salvamento oficial:

```text
VectorCadApp onProjectChange(data)
  ↓
SaasDashboard atualiza estado/ref
  ↓
saveProject()
  ├── cancela timer local
  ├── projects.update({ data, updated_at })
  ├── exige eq(id) e eq(user_id)
  ├── atualiza activeProject/lista local
  └── limpa localStorage após sucesso
```

### 4.6 Autenticação e autorização

- Browser: `lib/supabase/client.ts` usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou publishable key.
- Server: `lib/supabase/server.ts` usa URL pública/servidor, anon key para contexto do usuário e service role apenas em operações administrativas.
- `/editor`: `ProtectedEditor` exige sessão e `email_confirmed_at`.
- `/dashboard`: `SaasDashboard` carrega sessão, perfil, termos e uso antes de liberar o workspace.
- `/admin`: `lib/admin-auth.ts` valida bearer token, usuário autenticado, e-mail confirmado, role e service role; `lib/admin.ts` define `SUPER_ADMIN`, `ADMIN` e `USER`.
- RLS é a proteção de banco para dados de projetos e perfis. APIs administrativas usam service role apenas depois de autenticar e autorizar o administrador.

### 4.7 Plano efetivo e limites

`lib/access-control.ts` contém regras de capacidade para free/plus/pro/empresarial. `lib/effective-plan.ts` resolve o plano no servidor com a seguinte prioridade prática:

1. empresa empresarial ativa ou associação SM&A;
2. assinatura Mercado Pago ativa;
3. plano individual do perfil;
4. `free`.

Esse resultado é usado para anúncios, exportação DXF, limites diários e recursos premium. Ao modificar essa lógica, preservar a diferença entre plano salvo no perfil e plano efetivo calculado.

## 5. Integrações Externas

### 5.1 Supabase

Arquivos principais:

- `lib/supabase/client.ts`: cliente browser, sem service role.
- `lib/supabase/server.ts`: cliente server/auth e cliente administrativo.
- `supabase/projects.sql`: tabela e RLS de projetos.
- `supabase/profiles.sql`: perfil, termos e onboarding.
- `supabase/enterprise.sql`: empresas, usuários espelhados, subscriptions e logs.
- `supabase/migrations/*.sql`: roles, uso diário, memberships, terms, onboarding e vínculos.

Variáveis:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (fallback compatível)
SUPABASE_URL (server fallback)
SUPABASE_SERVICE_ROLE_KEY (somente server/scripts)
```

Nunca enviar `SUPABASE_SERVICE_ROLE_KEY` para Client Components ou bundles públicos.

### 5.2 API interna e rotas de domínio

| Endpoint | Função |
|---|---|
| `/api/auth/signup` | Valida domínio, cria conta e inicia confirmação |
| `/api/auth/resend-confirmation` | Reenvia confirmação |
| `/api/profile/update` | Atualiza perfil protegido |
| `/api/usage/consume` | Consome uso diário e retorna snapshot |
| `/api/process` | Processamento de imagem |
| `/api/vectorize` | Vetorização |
| `/api/upload` | Upload/processamento de arquivo |
| `/api/export/svg` | Exportação SVG server-side quando utilizada |
| `/api/export/dxf` | Exportação DXF |
| `/api/image/enhance` | Enhance server-side com limites de memória |
| `/api/ai/vision` | OCR/Vision/AI Engine por regiões |
| `/api/payment/create` | Criação de checkout |
| `/api/payment/webhook` | Confirmação de pagamento e assinatura |
| `/api/email/*` | E-mails de welcome, reset e outros |
| `/api/admin/*` | Usuários, empresas, projetos e overview administrativo |

### 5.3 Resend e e-mails

`lib/resend.ts` encapsula o SDK e resolve:

- `RESEND_API_KEY`;
- `RESEND_FROM_EMAIL`, com remetente padrão `VectorCAD <contato@vetorcad.com.br>`;
- URL de aplicação para links.

Templates React Email:

```text
emails/email-shell.tsx
emails/welcome-email.tsx
emails/email-confirmation-email.tsx
emails/password-reset-email.tsx
emails/payment-approved-email.tsx
emails/daily-limit-reached-email.tsx
```

As rotas server-side geram links de confirmação/recovery e enviam HTML pelo Resend. A chave nunca deve aparecer no frontend.

### 5.4 Mercado Pago

Arquivos:

- `lib/mercadopago.ts`: access token, chamada HTTP, normalização de status e planos.
- `lib/billing.ts`: catálogo e capacidades de `free`, `plus`, `pro` e `empresarial`.
- `app/api/payment/create/route.ts`: cria preferência/checkout.
- `app/api/payment/webhook/route.ts`: consulta/valida pagamento e atualiza `subscriptions` e perfil.
- `supabase/enterprise.sql`: estrutura de subscriptions.

Variáveis:

```text
MERCADOPAGO_ACCESS_TOKEN       # somente server
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
```

O access token não pode ser importado por componentes client.

### 5.5 OCR, Vision e IA híbrida

- Tesseract.js roda no pipeline OCR local em `lib/text-detection/ocr.ts`.
- `lib/ai/vectorcad-ai.ts` define contratos, provider, classificação e fusão.
- `RealVisionProvider` usa endpoint multimodal compatível com API HTTP e lê `VISION_API_KEY`, `VISION_API_URL` e `VISION_MODEL` no backend.
- `MockProvider` permite desenvolvimento/testes sem chamada externa.
- `lib/ai/text-fusion.ts` consolida resultados OCR/Vision, prioriza confiança e remove duplicados.
- `lib/ai/vision-object-detector.ts` reconhece objetos técnicos.
- `lib/ai/element-recognition.ts` estrutura elementos derivados de textos/objetos.
- `lib/ai/dimension-recognition.ts` prepara reconhecimento de cotas com evidência textual e geométrica.

O desenho recomendado para evolução é manter toda chamada Vision atrás de `app/api/ai/vision/route.ts`, com timeout, parsing defensivo, fallback OCR e logs sem tokens, pixels ou conteúdo sensível.

### 5.6 Imagem, vetorização e exportação

```text
UTIF / Canvas / Sharp
  ↓
lib/image-processing/process.ts
  ↓
cad-clean.ts / ai-enhance.ts / image-quality-analyzer.ts
  ↓
lib/vectorize/contours.ts
  ↓
lib/vector/line-intelligence.ts
  ↓
lib/vector/vector-cleanup.ts
  ↓
lib/exporters/svg.ts ou lib/exporters/dxf.ts
```

- `lib/image-processing/tiff.ts`: detecta/decodifica TIFF e gera preview PNG interno.
- `lib/image-processing/binary.ts`: operações binárias, componentes conectados e morfologia.
- `lib/image-processing/cad-clean.ts`: limpeza e normalização para desenho técnico.
- `lib/image-processing/ai-enhance.ts`: modos de upscale/processamento com execução segura no servidor.
- `lib/image-processing/image-quality-analyzer.ts`: recomenda modo de processamento sem executar filtros pesados.
- `lib/vectorize/contours.ts`: extrai contornos, simplifica e escala o documento.
- `lib/vector/line-intelligence.ts`: classifica, unifica e remove duplicidades com fallback quando o vetor resultaria vazio.
- `lib/vector/vector-cleanup.ts`: suavização, Douglas-Peucker e limpeza por qualidade.
- `lib/exporters/dxf.ts`: gera layers e entidades; textos inteligentes usam a layer `TEXTOS` quando habilitados.
- `lib/exporters/svg.ts`: gera SVG a partir do `VectorDocument`.

### 5.7 Three.js

`components/SvgTo3DCadViewer.tsx` converte o documento vetorial em uma cena 3D e oferece câmera orbit, zoom, pan, vistas rápidas, layers, seleção, propriedades e medições. `components/protected-project-3d-viewer.tsx` garante que a nova guia carregue o projeto do Supabase em vez de depender do estado React da aba original.

## 6. Pontos de Atenção para Refatoração

1. **Orquestração concentrada:** `components/vector-cad-app.tsx` reúne estado, processamento, IA, exportação e grande parte da UI. A primeira refatoração segura deveria separar domínio/hooks de apresentação sem alterar os contratos de `CadProjectData`.
2. **Dois autosaves:** o rascunho local usa 60 segundos, enquanto o auto-save do dashboard usa aproximadamente 900 ms. Definir uma política única ou separar explicitamente “draft local” de “persistência remota”.
3. **Imagens em JSONB:** Data URLs dentro de `projects.data` podem aumentar muito o payload, o tempo de update e o consumo do banco. Um próximo desenho pode mover binários para Storage e guardar referências no JSON.
4. **Modelos duplicados de usuário:** existem `profiles`, `users`, `companies` e `companies_users`. A fonte de verdade de `company_id`, plano e role precisa ser documentada e mantida por migrations/trigger, especialmente para evitar divergência entre plano salvo e plano efetivo.
5. **RLS versus service role:** service role deve ficar restrita a rotas server-side e scripts. O client deve usar anon/publishable key e depender de RLS.
6. **Limites de payload Vision:** o fluxo atual trabalha por regiões e limita quantidade/tamanho para evitar bloquear o browser. Aumentar resolução ou enviar a imagem inteira deve ser uma decisão server-side com limites de memória e timeout.
7. **Ambiente público:** variáveis `NEXT_PUBLIC_*` são embutidas no build do Next.js; alterações na Vercel exigem novo deployment. Secrets sem prefixo público devem ser lidos apenas em Server Components, Route Handlers ou scripts.
8. **Compatibilidade de projetos antigos:** todos os novos campos em `CadProjectData` são opcionais. Qualquer mudança de schema deve manter defaults para projetos sem `aiAnalysis`, `imageAnalysis`, `document`, onboarding ou configurações novas.
9. **Autorização em múltiplas camadas:** o frontend pode redirecionar por UX, mas APIs e queries críticas devem continuar validando sessão, `user_id`, role e RLS no servidor.

## 7. Ordem Recomendada para uma Refatoração Futura

1. Extrair tipos e estado do editor para hooks/domínios independentes.
2. Criar um serviço único de carregamento/salvamento de `CadProjectData`.
3. Separar pipeline de imagem, pipeline vetorial e pipeline AI em serviços puros testáveis.
4. Definir uma fonte oficial para perfil, memberships, empresa e plano efetivo.
5. Mover imagens grandes para Supabase Storage e manter apenas metadados/referências no projeto.
6. Extrair a UI do editor em painéis: upload, processamento, viewport, inspeção, IA, CAD e exportação.
7. Preservar os endpoints existentes durante a migração e adicionar testes de contrato para Auth, projetos, exportação e billing.


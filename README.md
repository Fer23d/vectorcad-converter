# VectorCAD Converter

Aplicativo web para transformar PNG, JPG, JPEG e WEBP em vetores editáveis para CAD. O mesmo conjunto de contornos é exportado como paths SVG ou entidades `LWPOLYLINE` em DXF, com escala e unidade configuráveis.

**Aplicação em produção:** [vectorcad-converter.vercel.app](https://vectorcad-converter.vercel.app)

## Tecnologias e escolhas

- **Next.js, React e TypeScript**: interface e rotas de backend em um único projeto.
- **Tailwind CSS**: interface responsiva e consistente.
- **Canvas API**: leitura, escala e pré-processamento instantâneo no navegador, sem enviar a imagem do usuário.
- **Pipeline de contornos próprio, equivalente ao Potrace para imagens binárias**: extrai arestas dos pixels, costura contornos e aplica simplificação Ramer-Douglas-Peucker. A geometria resultante é compartilhada pelos exportadores, evitando divergência entre SVG e DXF.
- **Exportadores SVG/DXF próprios**: mantêm o projeto leve e permitem controlar `viewBox`, unidades, layers e entidades CAD.

## Instalação e execução

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

Para validar e gerar a versão de produção:

```bash
npm test
npm run build
npm start
```

## Deploy na Vercel

O repositório inclui `vercel.json` e está pronto para deploy automático pela integração GitHub da Vercel. Importe o repositório, mantenha o preset **Next.js**, o diretório raiz como `./` e o branch de produção como `main`. Cada push em `main` gera um novo deploy de produção.

## Como usar

1. Arraste uma imagem para a área de upload ou clique em **Enviar imagem**.
2. Ajuste brilho, contraste e threshold. Ative detecção de linhas internas para desenhos técnicos.
3. Escolha o modo de vetorização e ajuste simplificação e fragmento mínimo.
4. Confira os previews Original, Processada e Vetor.
5. Defina unidade, largura e altura reais.
6. Exporte em DXF, SVG ou PNG preview.

## DXF e AutoCAD

O DXF é ASCII AutoCAD 2007 (`AC1021`) e usa entidades `LINE` universais e editáveis, para abrir também em CADs móveis, versões antigas e softwares CAM mais restritivos. A estrutura completa é gerada pela biblioteca `dxf-writer`, incluindo Model Space, Blocks, Objects, unidades, limites reais das entidades e layers compatíveis com leitores CAD rigorosos. Contornos maiores são colocados no layer `CONTOURS`; detalhes menores, em `DETAILS`; o layer `GUIDES` também é criado para uso posterior. No AutoCAD, use `PEDIT` + `JOIN` para unir segmentos quando necessário.

No AutoCAD, use **OPEN** ou **IMPORT**, selecione o `.dxf` e confirme a unidade usada na exportação. O desenho já abre centralizado; se uma configuração local do CAD substituir a viewport, execute `ZOOM` e depois `E` (Extents). Caso o desenho seja aberto sem unidade, use `-DWGUNITS` e selecione milímetros ou centímetros. Os contornos podem ser editados com `PEDIT`.

## Melhores imagens

- Prefira fundo claro uniforme e traços escuros.
- Logos, silhuetas, desenhos técnicos e imagens de alto contraste produzem os melhores resultados.
- Para linhas finas, ative **Detectar linhas internas** e use o modo **Alta precisão**.
- Para corte laser/CNC, use o modo correspondente, aumente **Fragmento mínimo** e mantenha **Fechar contornos** ativo.

## Limitações

A vetorização é monocromática e baseada em contornos binários. Fotografias complexas precisam de ajuste forte de threshold e podem gerar muitos fragmentos. Curvas são representadas por polilinhas simplificadas, uma escolha amplamente compatível com CAD/CAM. O processamento principal ocorre localmente no navegador; nenhuma imagem é persistida no servidor.

## APIs

- `POST /api/upload`: valida tipo e tamanho do arquivo, sem persistência.
- `POST /api/process`: transforma valores de luminância em bitmap binário.
- `POST /api/vectorize`: converte bitmap binário em documento vetorial.
- `POST /api/export/svg`: exporta um documento vetorial como SVG.
- `POST /api/export/dxf`: exporta um documento vetorial como DXF.

O limite de upload é 12 MB. Tipos executáveis e formatos não reconhecidos são rejeitados.

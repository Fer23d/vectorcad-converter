export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
  sections: { heading: string; body: string[] }[];
};

export const blogArticles: BlogArticle[] = [
  {
    slug: "como-converter-imagem-em-dxf-para-autocad",
    title: "Como converter imagem em DXF para AutoCAD sem redesenhar tudo",
    description: "Entenda quando uma imagem pode virar vetor CAD, como preparar o arquivo e quais ajustes melhoram o DXF final.",
    date: "2026-07-09",
    readTime: "6 min",
    category: "CAD",
    sections: [
      {
        heading: "O que o DXF precisa ter para ser editável",
        body: [
          "Um arquivo DXF útil para CAD não deve ser apenas uma imagem colada dentro do desenho. Ele precisa conter entidades vetoriais, como polilinhas, contornos e curvas aproximadas, para que o usuário consiga editar, medir, escalar e enviar para corte ou fabricação.",
          "No VectorCAD, a imagem passa por pré-processamento, vetorização por contorno e exportação em layers. Isso ajuda a transformar logos, desenhos em preto e branco e silhuetas em geometrias mais próximas de um desenho técnico.",
        ],
      },
      {
        heading: "Como preparar a imagem antes da conversão",
        body: [
          "Use imagens com bom contraste, bordas claras e fundo simples. Quanto menos ruído, sombra e compressão, mais limpo tende a ficar o contorno final.",
          "Ajustes como threshold, contraste, remoção de ruído e inversão de cores são importantes porque definem quais áreas viram linhas e quais áreas serão descartadas.",
        ],
      },
      {
        heading: "Quando usar DXF, SVG ou STL",
        body: [
          "Use SVG quando o objetivo for editar em Illustrator, CorelDRAW ou visualizar na web. Use DXF quando o objetivo for abrir no AutoCAD, Fusion 360 ou software CAM. Use STL quando o desenho já foi transformado em uma extrusão 3D.",
        ],
      },
    ],
  },
  {
    slug: "svg-para-corte-laser-e-cnc",
    title: "SVG para corte laser e CNC: boas práticas para contornos limpos",
    description: "Veja como simplificação, fechamento de caminhos e escala correta ajudam na preparação de arquivos para fabricação digital.",
    date: "2026-07-09",
    readTime: "5 min",
    category: "CNC",
    sections: [
      {
        heading: "Contornos fechados evitam problemas na maquina",
        body: [
          "Em corte laser e CNC, caminhos abertos podem gerar falhas, cortes incompletos ou trajetórias inesperadas. Por isso, fechar contornos e remover pequenos fragmentos é uma etapa essencial.",
          "A simplificação também é importante: pontos demais deixam o arquivo pesado e podem causar movimentos desnecessários na máquina.",
        ],
      },
      {
        heading: "Escala em milímetros",
        body: [
          "Antes de exportar, defina largura e altura reais do desenho. Isso reduz erros ao importar em softwares de CAD/CAM e evita que um logo de poucos centímetros abra com tamanho incorreto.",
        ],
      },
    ],
  },
  {
    slug: "vetorizacao-de-logo-para-cad",
    title: "Vetorização de logo para CAD: do PNG ao vetor técnico",
    description: "Aprenda por que logos simples geram melhores resultados e como ajustar threshold e suavização para criar paths editáveis.",
    date: "2026-07-09",
    readTime: "4 min",
    category: "Vetorização",
    sections: [
      {
        heading: "Logos funcionam bem quando há contraste",
        body: [
          "Logos em preto e branco, marcas com áreas bem definidas e arquivos sem fundo complexo costumam gerar os melhores vetores. Gradientes, sombras e texturas precisam de limpeza antes da conversão.",
        ],
      },
      {
        heading: "Menos pontos, mais controle",
        body: [
          "Um bom vetor CAD não precisa repetir cada pixel da imagem original. O ideal é manter a forma visual, mas reduzir pontos redundantes para que a edição seja prática.",
        ],
      },
    ],
  },
];

export function getArticle(slug: string) {
  return blogArticles.find((article) => article.slug === slug);
}

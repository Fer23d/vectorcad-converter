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
        heading: "O que o DXF precisa ter para ser editavel",
        body: [
          "Um arquivo DXF util para CAD nao deve ser apenas uma imagem colada dentro do desenho. Ele precisa conter entidades vetoriais, como polilinhas, contornos e curvas aproximadas, para que o usuario consiga editar, medir, escalar e enviar para corte ou fabricacao.",
          "No VectorCAD, a imagem passa por pre-processamento, vetorizacao por contorno e exportacao em layers. Isso ajuda a transformar logos, desenhos em preto e branco e silhuetas em geometrias mais proximas de um desenho tecnico.",
        ],
      },
      {
        heading: "Como preparar a imagem antes da conversao",
        body: [
          "Use imagens com bom contraste, bordas claras e fundo simples. Quanto menos ruido, sombra e compressao, mais limpo tende a ficar o contorno final.",
          "Ajustes como threshold, contraste, remocao de ruido e inversao de cores sao importantes porque definem quais areas viram linhas e quais areas serao descartadas.",
        ],
      },
      {
        heading: "Quando usar DXF, SVG ou STL",
        body: [
          "Use SVG quando o objetivo for editar em Illustrator, CorelDRAW ou visualizar na web. Use DXF quando o objetivo for abrir no AutoCAD, Fusion 360 ou software CAM. Use STL quando o desenho ja foi transformado em uma extrusao 3D.",
        ],
      },
    ],
  },
  {
    slug: "svg-para-corte-laser-e-cnc",
    title: "SVG para corte laser e CNC: boas praticas para contornos limpos",
    description: "Veja como simplificacao, fechamento de caminhos e escala correta ajudam na preparacao de arquivos para fabricacao digital.",
    date: "2026-07-09",
    readTime: "5 min",
    category: "CNC",
    sections: [
      {
        heading: "Contornos fechados evitam problemas na maquina",
        body: [
          "Em corte laser e CNC, caminhos abertos podem gerar falhas, cortes incompletos ou trajetorias inesperadas. Por isso, fechar contornos e remover pequenos fragmentos e uma etapa essencial.",
          "A simplificacao tambem e importante: pontos demais deixam o arquivo pesado e podem causar movimentos desnecessarios na maquina.",
        ],
      },
      {
        heading: "Escala em milimetros",
        body: [
          "Antes de exportar, defina largura e altura reais do desenho. Isso reduz erros ao importar em softwares de CAD/CAM e evita que um logo de poucos centimetros abra com tamanho incorreto.",
        ],
      },
    ],
  },
  {
    slug: "vetorizacao-de-logo-para-cad",
    title: "Vetorizacao de logo para CAD: do PNG ao vetor tecnico",
    description: "Aprenda por que logos simples geram melhores resultados e como ajustar threshold e suavizacao para criar paths editaveis.",
    date: "2026-07-09",
    readTime: "4 min",
    category: "Vetorizacao",
    sections: [
      {
        heading: "Logos funcionam bem quando ha contraste",
        body: [
          "Logos em preto e branco, marcas com areas bem definidas e arquivos sem fundo complexo costumam gerar os melhores vetores. Gradientes, sombras e texturas precisam de limpeza antes da conversao.",
        ],
      },
      {
        heading: "Menos pontos, mais controle",
        body: [
          "Um bom vetor CAD nao precisa repetir cada pixel da imagem original. O ideal e manter a forma visual, mas reduzir pontos redundantes para que a edicao seja pratica.",
        ],
      },
    ],
  },
];

export function getArticle(slug: string) {
  return blogArticles.find((article) => article.slug === slug);
}

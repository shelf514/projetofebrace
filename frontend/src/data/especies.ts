export const ESPECIES = [
  'betta', 'neon', 'guppy', 'molinesia', 'plati', 'espada', 'cascudo', 'kingui',
  'colisa', 'matogrosso', 'coridora', 'acaradisco', 'oscar', 'tetra', 'paulistinha',
  'acarabandeira', 'ramirezi', 'barbotigre', 'camarao', 'tanictis', 'rasbora',
  'tricogaster', 'rodostomo', 'labeo', 'botia', 'carpakoi', 'acaraano', 'tetacardi',
  'cascudozebra', 'guppyendler',
] as const;

export type EspecieId = (typeof ESPECIES)[number];

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  unit: string;
  provider: "COMPANY_OWNED" | "INDEPENDENT_PARTNER" | "BUSINESS_PARTNER";
  includes: string[];
  excludes: string[];
  description: string;
  image: string;
  imageFit?: "cover" | "contain";
}

export interface Category {
  id: string;
  name: string;
  short: string;
  icon: string;
  image: string;
  imageFit?: "cover" | "contain";
  services: Service[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  priceAOA: number;
  promotionalPriceAOA?: number;
  available: boolean;
  stock: number;
  sellerName: string;
  sellerId: string;
  sellerType: "COMPANY" | "PARTNER" | "PRACA_SELLER";
  category: string;
  image: string;
  imageFit?: "cover" | "contain";
  deliveryLocation: string;
  estimatedDelivery: string;
  warranty?: string;
  unit: string;
  rating?: number;
  reviewsCount?: number;
  badge?: string;
  // Praça Marketplace Specific Fields
  isPraca?: boolean;
  pracaCategoryId?: string;
  subcategory?: string;
  brand?: string;
  sku?: string;
  condition?: "NOVO" | "USADO";
  images?: string[];
  platformCommissionRate?: number; // e.g. 10 (%)
  affiliateCommissionRate?: number; // e.g. 5 (%)
  variations?: Array<{ name: string; options: string[] }>;
  deliveryOption?: "DELIVERY" | "PICKUP" | "BOTH";
  status?: "ATIVO" | "OCULTO" | "PENDENTE_APROVACAO" | "ARQUIVADO";
}

export const PROVIDERS = {
  COMPANY_OWNED: "Equipa Resolve",
  INDEPENDENT_PARTNER: "Parceiro verificado",
  BUSINESS_PARTNER: "Empresa parceira",
} as const;

export interface SubscriptionPlan {
  id: "free" | "family" | "premium" | "business";
  name: string;
  badge?: string;
  priceAOA: number;
  period: "mês";
  description: string;
  benefits: string[];
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "FREE",
    priceAOA: 0,
    period: "mês",
    description: "Acesso total a todos os serviços da Resolve Express sem compromisso mensal.",
    benefits: [
      "Acesso aos 12 departamentos",
      "Pagamento por serviço ou produto",
      "Suporte via WhatsApp",
      "Acompanhamento de pedidos em tempo real",
    ],
  },
  {
    id: "family",
    name: "FAMILY",
    badge: "Mais Popular",
    priceAOA: 18000,
    period: "mês",
    popular: true,
    description: "Benefícios exclusivos para o cuidado contínuo da sua casa e família.",
    benefits: [
      "10% de desconto em Serviços para Casa e Lavandaria",
      "Agendamento prioritário nos fins-de-semana",
      "1 Lavagem auto externa de cortesia por mês",
      "Atribuição preferencial da mesma equipa de limpeza",
      "Cancelamento gratuito até 2h antes",
    ],
  },
  {
    id: "premium",
    name: "PREMIUM",
    priceAOA: 38000,
    period: "mês",
    description: "Máxima conveniência, rapidez e atendimento VIP para clientes exigentes.",
    benefits: [
      "15% de desconto em todos os serviços e produtos parceiros",
      "Taxa de urgência/deslocação gratuita no Huambo",
      "Linha direta VIP de WhatsApp com gestor pessoal",
      "Garantia de atendimento no próprio dia (quando solicitado até às 12h)",
      "2 check-ups preventivos de canalização/eletricidade por ano",
    ],
  },
  {
    id: "business",
    name: "BUSINESS",
    badge: "Empresas",
    priceAOA: 95000,
    period: "mês",
    description: "Soluções completas e centralizadas para escritórios, clínicas e empresas.",
    benefits: [
      "Faturação mensal unificada com NIF",
      "Gestor de conta corporativo dedicado",
      "Limpeza e manutenção programada com SLA garantido",
      "Tarifas especiais para frotas de viaturas e estafetagem",
      "Substituição de funcionário em menos de 2 horas",
    ],
  },
];

type RawCategory = [
  string, // id
  string, // name (em português exato)
  string, // short
  string, // icon
  string, // image
  "COMPANY_OWNED" | "INDEPENDENT_PARTNER" | "BUSINESS_PARTNER", // provider
  string, // unit
  string[], // services
  string[], // includes
  string[], // excludes
];

// Nomes traduzidos para Português conforme exigido na Secção 6
const rawCategories: RawCategory[] = [
  [
    "casa",
    "Serviços para Casa",
    "Limpeza e organização da sua casa.",
    "Home",
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
    "COMPANY_OWNED",
    "divisão",
    [
      "Limpeza geral",
      "Limpeza profunda",
      "Limpeza de cozinhas",
      "Limpeza de casas de banho",
      "Lavagem de louça",
      "Limpeza de quartos",
      "Limpeza de quintais",
      "Organização doméstica",
      "Limpeza pós-evento",
      "Limpeza após mudanças",
    ],
    [
      "Produtos de limpeza profissionais",
      "Equipa uniformizada e identificada",
      "Verificação final consigo",
    ],
    [
      "Remoção de entulho",
      "Trabalhos em altura sem equipamento adequado",
    ],
  ],
  [
    "lavandaria",
    "Lavandaria",
    "Roupa lavada, passada e entregue.",
    "Shirt",
    "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80",
    "COMPANY_OWNED",
    "kg",
    [
      "Lavagem de roupas",
      "Engomadoria",
      "Dobragem",
      "Secagem",
      "Recolha e entrega",
      "Lavagem de cobertores",
      "Lavagem de cortinas",
      "Lavagem de tapetes",
    ],
    [
      "Detergente e amaciador",
      "Saco identificado por cliente",
      "Prazo combinado na confirmação",
    ],
    [
      "Peças de limpeza a seco especial",
      "Reparação de costuras",
    ],
  ],
  [
    "food",
    "Alimentação",
    "Refeições quentes, à sua porta.",
    "UtensilsCrossed",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
    "BUSINESS_PARTNER",
    "dose",
    [
      "Frango assado",
      "Cafraia",
      "Marmitas",
      "Pequeno-almoço",
      "Almoço",
      "Jantar",
      "Pizzas",
      "Hambúrgueres",
      "Sumos naturais",
      "Cozinheiro ao domicílio",
      "Catering",
    ],
    [
      "Embalagem térmica",
      "Entrega pelo restaurante parceiro",
    ],
    [
      "Bebidas não indicadas no pedido",
      "Loiça e mobiliário para eventos (salvo catering)",
    ],
  ],
  [
    "family",
    "Família e Cuidados",
    "Cuidado de confiança para quem ama.",
    "HeartHandshake",
    "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=800&q=80",
    "INDEPENDENT_PARTNER",
    "hora",
    [
      "Babysitting",
      "Acompanhamento de crianças",
      "Acompanhamento de idosos",
      "Companhia para idosos",
      "Acompanhamento a consultas",
      "Apoio familiar",
      "Apoio escolar e explicação",
    ],
    [
      "Cuidador com documentos verificados",
      "Relatório breve no fim do serviço",
    ],
    [
      "Administração de medicamentos sem prescrição",
      "Cuidados de enfermagem",
    ],
  ],
  [
    "auto",
    "Automóveis",
    "O seu carro limpo sem sair de casa.",
    "Car",
    "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80",
    "COMPANY_OWNED",
    "viatura",
    [
      "Lavagem exterior",
      "Lavagem interior",
      "Higienização",
      "Polimento",
      "Lavagem de motorizadas",
      "Pequenas assistências",
    ],
    [
      "Produtos automóveis próprios",
      "Lavagem no local indicado",
    ],
    [
      "Reparações mecânicas",
      "Água, quando não houver ponto disponível",
    ],
  ],
  [
    "shopping",
    "Compras",
    "Fazemos as compras por si.",
    "ShoppingBasket",
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
    "COMPANY_OWNED",
    "pedido",
    [
      "Compras de supermercado",
      "Compras no mercado",
      "Compras em lojas",
      "Compras de produtos domésticos",
      "Compras personalizadas",
      "Recolha de encomendas",
    ],
    [
      "Fotografia do talão",
      "Confirmação de substituições consigo",
    ],
    [
      "Valor dos produtos (pago à parte)",
      "Produtos sujeitos a licença",
    ],
  ],
  [
    "garden",
    "Jardinagem",
    "Quintal e jardim bem cuidados.",
    "Sprout",
    "https://images.unsplash.com/photo-1557429287-b2e26467fc2b?auto=format&fit=crop&w=800&q=80",
    "INDEPENDENT_PARTNER",
    "m²",
    [
      "Corte de relva",
      "Limpeza de quintais",
      "Poda",
      "Manutenção de jardins",
      "Plantação",
      "Limpeza de terrenos",
    ],
    [
      "Ferramentas do profissional",
      "Recolha dos resíduos verdes",
    ],
    [
      "Plantas e adubo (orçamentados à parte)",
      "Abate de árvores de grande porte",
    ],
  ],
  [
    "tech",
    "Reparações e Assistência Técnica",
    "Reparações feitas por quem sabe.",
    "Wrench",
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80",
    "INDEPENDENT_PARTNER",
    "visita",
    [
      "Canalização",
      "Eletricidade",
      "Carpintaria",
      "Pintura",
      "Montagem de móveis",
      "Instalação de equipamentos",
      "Reparações domésticas",
    ],
    [
      "Diagnóstico no local",
      "Mão de obra orçamentada",
    ],
    [
      "Materiais e peças (orçamentados à parte)",
      "Obras que exijam licença",
    ],
  ],
  [
    "beauty",
    "Beleza e Cuidados Pessoais",
    "Beleza ao domicílio, com hora marcada.",
    "Scissors",
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
    "INDEPENDENT_PARTNER",
    "pessoa",
    [
      "Cabeleireiro",
      "Tranças",
      "Barbeiro",
      "Manicure",
      "Pedicure",
      "Maquilhagem",
      "Penteados",
    ],
    [
      "Material higienizado",
      "Profissional com portefólio verificado",
    ],
    [
      "Extensões e cabelo sintético (salvo indicação)",
      "Tratamentos estéticos clínicos",
    ],
  ],
  [
    "delivery",
    "Entregas",
    "Levamos de um ponto ao outro.",
    "Package",
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    "COMPANY_OWNED",
    "entrega",
    [
      "Documentos",
      "Encomendas",
      "Recolha de produtos",
      "Entregas de refeições",
      "Entregas comerciais",
    ],
    [
      "Confirmação de entrega",
      "Contacto do estafeta no dia",
    ],
    [
      "Objetos proibidos ou perigosos",
      "Volumes acima de 20 kg sem aviso",
    ],
  ],
  [
    "agua-gas",
    "Água e Gás",
    "Água e gás sem filas.",
    "Droplets",
    "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80",
    "BUSINESS_PARTNER",
    "unidade",
    [
      "Água engarrafada",
      "Garrafões",
      "Botijas de gás (fornecedores autorizados)",
      "Produtos essenciais",
    ],
    [
      "Fornecedor autorizado",
      "Entrega à porta",
    ],
    [
      "Instalação de gás",
      "Troca de vasilhame sem casco",
    ],
  ],
  [
    "business",
    "Serviços para Empresas",
    "Operações simples para a sua empresa.",
    "Building2",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    "COMPANY_OWNED",
    "contrato",
    [
      "Limpeza empresarial",
      "Limpeza de escritórios",
      "Manutenção comercial",
      "Lavagem de frotas",
      "Entregas empresariais",
      "Apoio logístico",
      "Jardinagem empresarial",
    ],
    [
      "Gestor de conta dedicado",
      "Faturação mensal",
    ],
    [
      "Serviços fora do contrato acordado",
    ],
  ],
];

const slug = (e: string) =>
  e
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Imagens exactas e profissionais que representam cada serviço específico
export const SERVICE_IMAGES: Record<string, string> = {
  // Serviços para Casa
  "Limpeza geral": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
  "Limpeza profunda": "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80",
  "Limpeza de cozinhas": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
  "Limpeza de casas de banho": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
  "Lavagem de louça": "https://images.unsplash.com/photo-1585837575652-267c041d77d4?auto=format&fit=crop&w=800&q=80",
  "Limpeza de quartos": "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
  "Limpeza de quintais": "https://images.unsplash.com/photo-1598880940371-c756e015fea1?auto=format&fit=crop&w=800&q=80",
  "Organização doméstica": "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
  "Limpeza pós-evento": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80",
  "Limpeza após mudanças": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",

  // Lavandaria
  "Lavagem de roupas": "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=800&q=80",
  "Engomadoria": "https://images.unsplash.com/photo-1489274495757-95c7c837b101?auto=format&fit=crop&w=800&q=80",
  "Dobragem": "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80",
  "Secagem": "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80",
  "Recolha e entrega": "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=800&q=80",
  "Lavagem de cobertores": "https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=800&q=80",
  "Lavagem de cortinas": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
  "Lavagem de tapetes": "https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=800&q=80",

  // Alimentação
  "Frango assado": "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=800&q=80",
  "Cafraia": "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80",
  "Marmitas": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
  "Pequeno-almoço": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80",
  "Almoço": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80",
  "Jantar": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
  "Pizzas": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
  "Hambúrgueres": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
  "Sumos naturais": "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80",
  "Cozinheiro ao domicílio": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80",
  "Catering": "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80",

  // Família e Cuidados
  "Babysitting": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=800&q=80",
  "Acompanhamento de crianças": "https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=800&q=80",
  "Acompanhamento de idosos": "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=800&q=80",
  "Companhia para idosos": "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=800&q=80",
  "Acompanhamento a consultas": "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=800&q=80",
  "Apoio familiar": "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80",
  "Apoio escolar e explicação": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80",

  // Automóveis
  "Lavagem exterior": "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80",
  "Lavagem interior": "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80",
  "Higienização": "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=800&q=80",
  "Polimento": "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80",
  "Lavagem de motorizadas": "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80",
  "Pequenas assistências": "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80",

  // Compras
  "Compras de supermercado": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
  "Compras no mercado": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=800&q=80",
  "Compras em lojas": "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80",
  "Compras de produtos domésticos": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80",
  "Compras personalizadas": "https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=800&q=80",
  "Recolha de encomendas": "https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=800&q=80",

  // Jardinagem
  "Corte de relva": "https://images.unsplash.com/photo-1592417817098-8f3d69104a47?auto=format&fit=crop&w=800&q=80",
  "garden--limpeza-de-quintais": "https://images.unsplash.com/photo-1557429287-b2e26467fc2b?auto=format&fit=crop&w=800&q=80",
  "Poda": "https://images.unsplash.com/photo-1599685315640-9ceab2f58944?auto=format&fit=crop&w=800&q=80",
  "Manutenção de jardins": "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80",
  "Plantação": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80",
  "Limpeza de terrenos": "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?auto=format&fit=crop&w=800&q=80",

  // Reparações e Assistência Técnica
  "Canalização": "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80",
  "Eletricidade": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80",
  "Carpintaria": "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80",
  "Pintura": "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80",
  "Montagem de móveis": "https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=800&q=80",
  "Instalação de equipamentos": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
  "Reparações domésticas": "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=800&q=80",

  // Beleza e Cuidados Pessoais
  "Cabeleireiro": "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
  "Tranças": "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?auto=format&fit=crop&w=800&q=80",
  "Barbeiro": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
  "Manicure": "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80",
  "Pedicure": "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=800&q=80",
  "Maquilhagem": "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80",
  "Penteados": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",

  // Entregas
  "Documentos": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
  "Encomendas": "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80",
  "Recolha de produtos": "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=800&q=80",
  "Entregas de refeições": "https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=800&q=80",
  "Entregas comerciais": "https://images.unsplash.com/photo-1615460549969-36fa19521a4f?auto=format&fit=crop&w=800&q=80",

  // Água e Gás
  "Água engarrafada": "https://images.unsplash.com/photo-1559839914-1b34645a380e?auto=format&fit=crop&w=800&q=80",
  "Garrafões": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80",
  "Botijas de gás (fornecedores autorizados)": "https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=800&q=80",
  "Produtos essenciais": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80",

  // Serviços para Empresas
  "Limpeza empresarial": "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
  "Limpeza de escritórios": "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80",
  "Manutenção comercial": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
  "Lavagem de frotas": "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80",
  "Entregas empresariais": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
  "Apoio logístico": "https://images.unsplash.com/photo-1586528116493-a029325540fa?auto=format&fit=crop&w=800&q=80",
  "Jardinagem empresarial": "https://images.unsplash.com/photo-1557429287-b2e26467fc2b?auto=format&fit=crop&w=800&q=80",
};

export const CATEGORIES: Category[] = rawCategories.map(
  ([id, name, short, icon, image, provider, unit, services, includes, excludes]) => ({
    id,
    name,
    short,
    icon,
    image,
    services: services.map((s) => ({
      id: `${id}--${slug(s)}`,
      categoryId: id,
      name: s,
      unit,
      provider,
      includes,
      excludes,
      description: `${s} em Huambo, acompanhado pela Resolve Express do pedido à conclusão.`,
      image:
        SERVICE_IMAGES[`${id}--${slug(s)}`] ||
        SERVICE_IMAGES[s] ||
        image,
    })),
  })
);

export const DEFAULT_FEATURED = [
  "casa--limpeza-geral",
  "lavandaria--recolha-e-entrega",
  "food--frango-assado",
  "tech--canalizacao",
  "beauty--trancas",
  "agua-gas--garrafoes",
];

export interface AngolaProvince {
  id: string;
  name: string;
  capital: string;
  municipalities: string[];
}

export const ANGOLA_PROVINCES: AngolaProvince[] = [
  {
    id: "huambo",
    name: "Huambo",
    capital: "Huambo",
    municipalities: ["Huambo", "Bailundo", "Caála", "Catchiungo", "Chicala-Choloanga", "Chinjenje", "Ecunha", "Londuimbali", "Longonjo", "Mungo", "Ucuma"],
  },
  {
    id: "luanda",
    name: "Luanda",
    capital: "Luanda",
    municipalities: ["Luanda", "Belas", "Cacuaco", "Cazenga", "Icolo e Bengo", "Kilamba Kiaxi", "Quiçama", "Talatona", "Viana"],
  },
  {
    id: "benguela",
    name: "Benguela",
    capital: "Benguela",
    municipalities: ["Benguela", "Baía Farta", "Balombo", "Bocoio", "Caimbambo", "Catumbela", "Chongoroi", "Cubal", "Ganda", "Lobito"],
  },
  {
    id: "huila",
    name: "Huíla",
    capital: "Lubango",
    municipalities: ["Lubango", "Caconda", "Caluquembe", "Chiange", "Chibia", "Chicomba", "Chipindo", "Cuvango", "Humpata", "Jamba", "Matala", "Quilengues", "Quipungo"],
  },
  {
    id: "cabinda",
    name: "Cabinda",
    capital: "Cabinda",
    municipalities: ["Cabinda", "Belize", "Buco-Zau", "Cacongo"],
  },
  {
    id: "bie",
    name: "Bié",
    capital: "Cuíto",
    municipalities: ["Cuíto", "Andulo", "Camacupa", "Catabola", "Chinguar", "Chitembo", "Cuemba", "Cunhinga", "Nharea"],
  },
  {
    id: "cuanza-sul",
    name: "Cuanza Sul",
    capital: "Sumbe",
    municipalities: ["Sumbe", "Amboim (Gabela)", "Cassongue", "Cela (Waku Kungo)", "Conda", "Ebo", "Libolo", "Mussende", "Porto Amboim", "Quibala", "Quilenda", "Seles"],
  },
  {
    id: "cuanza-norte",
    name: "Cuanza Norte",
    capital: "Ndalatando",
    municipalities: ["Cazengo (Ndalatando)", "Ambaca", "Banga", "Bolongongo", "Cambambe", "Golungo Alto", "Gonguembo", "Lucala", "Quiculungo", "Samba Caju"],
  },
  {
    id: "malanje",
    name: "Malanje",
    capital: "Malanje",
    municipalities: ["Malanje", "Cacuso", "Calandula", "Cambundi-Catembo", "Cangandala", "Caombo", "Cuaba Nzogo", "Cunda-dia-Baze", "Luquembo", "Marimba", "Massango", "Mucari", "Quela", "Quirima"],
  },
  {
    id: "namibe",
    name: "Namibe",
    capital: "Moçâmedes",
    municipalities: ["Moçâmedes", "Bibala", "Camucuio", "Tômbwa", "Virei"],
  },
  {
    id: "uige",
    name: "Uíge",
    capital: "Uíge",
    municipalities: ["Uíge", "Ambuíla", "Bembe", "Buengas", "Bungo", "Damba", "Milunga", "Mucaba", "Negage", "Puri", "Quimbele", "Quitexe", "Sanza Pombo", "Songo", "Zombo"],
  },
  {
    id: "zaire",
    name: "Zaire",
    capital: "Mbanza Kongo",
    municipalities: ["Mbanza Kongo", "Cuimba", "Nóqui", "N'zeto", "Soyo", "Tomboco"],
  },
  {
    id: "bengo",
    name: "Bengo",
    capital: "Caxito",
    municipalities: ["Dande (Caxito)", "Ambriz", "Bula Atumba", "Dembos", "Nambuangongo", "Pango Aluquém"],
  },
  {
    id: "cunene",
    name: "Cunene",
    capital: "Ondjiva",
    municipalities: ["Cuanhama (Ondjiva)", "Cahama", "Curoca", "Cuvelai", "Namacunde", "Ombadja"],
  },
  {
    id: "cuando-cubango",
    name: "Cuando Cubango",
    capital: "Menongue",
    municipalities: ["Menongue", "Calai", "Cuangar", "Cuchi", "Cuito Cuanavale", "Dirico", "Mavinga", "Nancova", "Rivungo"],
  },
  {
    id: "moxico",
    name: "Moxico",
    capital: "Luena",
    municipalities: ["Moxico (Luena)", "Alto Zambeze", "Bundas", "Camanongue", "Cameia", "Léua", "Luau", "Luacano", "Luchazes"],
  },
  {
    id: "lunda-norte",
    name: "Lunda Norte",
    capital: "Dundo",
    municipalities: ["Chitato (Dundo)", "Cambulo", "Capenda-Camulemba", "Caungula", "Cuango", "Cuílo", "Lóvua", "Lubalo", "Lucapa", "Xá-Muteba"],
  },
  {
    id: "lunda-sul",
    name: "Lunda Sul",
    capital: "Saurimo",
    municipalities: ["Saurimo", "Cacolo", "Dala", "Muconda"],
  },
];

export const LOCATIONS = ANGOLA_PROVINCES.map((p) => ({
  id: p.id,
  name: `${p.name}`,
  capital: p.capital,
  active: true,
}));

export const SLOTS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

export interface PaymentMethodDef {
  id: "mcx" | "ref" | "transfer" | "cash" | "wallet";
  name: string;
  badge?: string;
  note: string;
  icon: string;
  ready: boolean;
}

export const PAYMENTS: PaymentMethodDef[] = [
  {
    id: "mcx",
    name: "Multicaixa Express",
    badge: "Instantâneo",
    note: "Pague com o seu telemóvel na app Multicaixa Express em segundos sem custos adicionais.",
    icon: "Smartphone",
    ready: true,
  },
  {
    id: "ref",
    name: "Referência Multicaixa",
    badge: "ATM / App",
    note: "Pague com Entidade e Referência em qualquer Caixa Automático ou banco online.",
    icon: "CreditCard",
    ready: true,
  },
  {
    id: "transfer",
    name: "Transferência Bancária (IBAN)",
    badge: "Comprovativo",
    note: "Transferência para contas oficiais BAI, BFA, Millennium Atlântico ou Banco Sol com envio de talão.",
    icon: "Landmark",
    ready: true,
  },
  {
    id: "cash",
    name: "Pagamento na Entrega (TPA / Dinheiro)",
    badge: "No Domicílio",
    note: "Pague ao estafeta no acto da entrega com cartão no terminal TPA móvel ou em dinheiro com troco garantido.",
    icon: "Banknote",
    ready: true,
  },
  {
    id: "wallet",
    name: "Carteira Digital Resolve Express",
    badge: "Saldo em Conta",
    note: "Debite diretamente do saldo da sua carteira na plataforma sem passos adicionais.",
    icon: "Wallet",
    ready: true,
  },
];

export interface AngolaBank {
  id: string;
  name: string;
  shortName: string;
  iban: string;
  accountNumber: string;
  holder: string;
  nif: string;
}

export const ANGOLA_BANKS: AngolaBank[] = [
  {
    id: "bai",
    name: "Banco BAI (Banco Angolano de Investimentos)",
    shortName: "BAI",
    iban: "AO06.0040.0000.1234.5678.9012.3",
    accountNumber: "12345678901",
    holder: "RESOLVE EXPRESS, LDA",
    nif: "5000129384",
  },
  {
    id: "bfa",
    name: "Banco BFA (Banco de Fomento Angola)",
    shortName: "BFA",
    iban: "AO06.0006.0000.9876.5432.1098.7",
    accountNumber: "98765432109",
    holder: "RESOLVE EXPRESS, LDA",
    nif: "5000129384",
  },
  {
    id: "atlantico",
    name: "Banco Millennium Atlântico (BMA)",
    shortName: "Atlântico",
    iban: "AO06.0055.0000.4567.8901.2345.6",
    accountNumber: "45678901234",
    holder: "RESOLVE EXPRESS, LDA",
    nif: "5000129384",
  },
  {
    id: "sol",
    name: "Banco Sol",
    shortName: "Banco Sol",
    iban: "AO06.0044.0000.3210.9876.5432.1",
    accountNumber: "32109876543",
    holder: "RESOLVE EXPRESS, LDA",
    nif: "5000129384",
  },
];

export const LEGAL_DOCS: Record<string, string> = {
  termos: "Termos e condições",
  privacidade: "Política de privacidade",
  cookies: "Política de cookies",
  cancelamento: "Política de cancelamento",
  reembolso: "Política de reembolso",
  profissionais: "Termos para profissionais",
  empresas: "Termos para empresas parceiras",
};

// ==========================================
// MARKETPLACE DE PRODUTOS (SISTEMA B)
// ==========================================

export const PRODUCT_CATEGORIES = [
  "Todos",
  "Alimentação",
  "Bebidas",
  "Mercearia",
  "Higiene pessoal",
  "Limpeza doméstica",
  "Produtos para casa",
  "Acessórios",
  "Produtos de beleza",
  "Produtos para automóveis",
  "Água e gás",
  "Outros produtos",
] as const;

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "PROD-001",
    name: "Garrafão de Água Mineral 20L",
    description: "Água mineral pura e tratada em garrafão de 20 litros. Entrega imediata à porta.",
    priceAOA: 2500,
    promotionalPriceAOA: 2200,
    available: true,
    stock: 85,
    sellerName: "Distribuidora Águas do Huambo",
    sellerId: "seller-1",
    sellerType: "PARTNER",
    category: "Água e gás",
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80",
    deliveryLocation: "Huambo (Todos os bairros)",
    estimatedDelivery: "30 a 60 minutos",
    unit: "unidade",
  },
  {
    id: "PROD-002",
    name: "Recarga de Botija de Gás 12kg",
    description: "Botija de gás butano com selo de segurança intacto de fornecedor oficial autorizado Sonangol/distribuidor.",
    priceAOA: 3500,
    available: true,
    stock: 40,
    sellerName: "Gás Express Huambo Lda",
    sellerId: "seller-2",
    sellerType: "PARTNER",
    category: "Água e gás",
    image: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80",
    deliveryLocation: "Huambo Central e Caála",
    estimatedDelivery: "45 a 90 minutos",
    unit: "garrafa",
  },
  {
    id: "PROD-003",
    name: "Frango Assado à Guia com Batatas",
    description: "Frango inteiro grelhado na brasa com molho especial de piripiri ou limão, acompanhado de batatas fritas estaladiças.",
    priceAOA: 6500,
    promotionalPriceAOA: 5800,
    available: true,
    stock: 25,
    sellerName: "Churrasqueira Central do Planalto",
    sellerId: "seller-3",
    sellerType: "PARTNER",
    category: "Alimentação",
    image: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=600&q=80",
    deliveryLocation: "Huambo (Cidade)",
    estimatedDelivery: "35 a 55 minutos",
    unit: "dose",
  },
  {
    id: "PROD-004",
    name: "Kit Profissional de Limpeza Doméstica Resolve",
    description: "Kit completo oficial com detergente multiusos 5L, desinfetante perfumado, lixívia, panos de microfibra e luvas de borracha.",
    priceAOA: 14500,
    promotionalPriceAOA: 12500,
    available: true,
    stock: 60,
    sellerName: "Resolve Express Store",
    sellerId: "seller-resolve",
    sellerType: "COMPANY",
    category: "Limpeza doméstica",
    image: "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=600&q=80",
    deliveryLocation: "Huambo",
    estimatedDelivery: "Hoje (até às 18h)",
    unit: "kit",
  },
  {
    id: "PROD-005",
    name: "Cesta Básica Familiar Essencial",
    description: "Arroz agulha 5kg, óleo vegetal 2L, açúcar branco 2kg, farinha de trigo 2kg, leite condensado e massa esparguete.",
    priceAOA: 28000,
    available: true,
    stock: 35,
    sellerName: "Supermercado Nova Esperança Huambo",
    sellerId: "seller-4",
    sellerType: "PARTNER",
    category: "Mercearia",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
    deliveryLocation: "Huambo e Caála",
    estimatedDelivery: "2 a 4 horas",
    unit: "cesta",
  },
  {
    id: "PROD-006",
    name: "Shampoo & Máscara Reparadora de Queratina",
    description: "Linha de cuidados capilares para hidratação intensiva e fortalecimento de cabelos cacheados e com tranças.",
    priceAOA: 9500,
    available: true,
    stock: 18,
    sellerName: "Salão & Cosméticos Flor do Planalto",
    sellerId: "seller-5",
    sellerType: "PARTNER",
    category: "Produtos de beleza",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80",
    deliveryLocation: "Huambo",
    estimatedDelivery: "1 a 2 horas",
    unit: "conjunto",
  },
  {
    id: "PROD-007",
    name: "Cera e Shampoo Automóvel Brilho Espelho",
    description: "Produtos profissionais com pH neutro e cera de carnaúba para proteção de pintura e brilho duradouro.",
    priceAOA: 8000,
    available: true,
    stock: 22,
    sellerName: "Resolve Express Auto Supply",
    sellerId: "seller-resolve",
    sellerType: "COMPANY",
    category: "Produtos para automóveis",
    image: "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=600&q=80",
    deliveryLocation: "Huambo",
    estimatedDelivery: "Hoje",
    unit: "kit",
  },
  {
    id: "PROD-008",
    name: "Pack de Bebidas Energéticas & Sumos Naturais (6 un)",
    description: "6 sumos naturais frescos de maracujá, manga e laranja engarrafados na hora sem conservantes.",
    priceAOA: 4200,
    promotionalPriceAOA: 3800,
    available: true,
    stock: 50,
    sellerName: "Planaltina Sumos & Lanches",
    sellerId: "seller-6",
    sellerType: "PARTNER",
    category: "Bebidas",
    image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=600&q=80",
    deliveryLocation: "Huambo Cidade",
    estimatedDelivery: "30 a 45 minutos",
    unit: "pack",
  },
];

export const allServices = (): Service[] => CATEGORIES.flatMap((c) => c.services);
export const findService = (id: string): Service | undefined =>
  allServices().find((s) => s.id === id);
export const findCategory = (id: string): Category | undefined =>
  CATEGORIES.find((c) => c.id === id);

export interface HeroBanner {
  id: string;
  eyebrow: string;
  badge: string;
  titleStart: string;
  titleHighlight: string;
  description: string;
  primaryBtn: string;
  primaryTo: string;
  secondaryBtn: string;
  secondaryTo: string;
  footerText?: string;
  image: string;
  imageFit?: "cover" | "contain";
  active?: boolean;
  // Controlos de Visibilidade pelo Super Admin
  showEyebrow?: boolean;
  showBadge?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  showButtons?: boolean;
  showPrimaryBtn?: boolean;
  showSecondaryBtn?: boolean;
  showFooterText?: boolean;
}

export const DEFAULT_HERO_BANNERS: HeroBanner[] = [
  {
    id: "servicos",
    eyebrow: "Serviços ao Domicílio",
    badge: "Huambo · Equipa Verificada",
    titleStart: "Tu cuidas da tua vida.",
    titleHighlight: "Nós cuidamos do resto!",
    description:
      "Serviços de limpeza, canalização, reparações e apoio ao domicílio com rapidez e confiança.",
    primaryBtn: "Explorar serviços",
    primaryTo: "/servicos",
    secondaryBtn: "Solicitar um serviço",
    secondaryTo: "/servicos",
    footerText: "Atendimento rápido ao domicílio em toda a província do Huambo",
    image:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=85&w=1920&auto=format&fit=crop",
    active: true,
    showEyebrow: true,
    showBadge: true,
    showTitle: true,
    showDescription: true,
    showButtons: true,
    showPrimaryBtn: true,
    showSecondaryBtn: true,
    showFooterText: true,
  },
  {
    id: "marketplace",
    eyebrow: "Loja e Produtos Essenciais",
    badge: "Entregas Rápidas no Huambo",
    titleStart: "Água, gás e compras.",
    titleHighlight: "Entregues à sua porta!",
    description:
      "Compre gás Sonangol, garrafões de água mineral, mercearia e produtos essenciais com entrega em minutos.",
    primaryBtn: "Comprar Produtos",
    primaryTo: "/produtos",
    secondaryBtn: "Ver Promoções",
    secondaryTo: "/produtos",
    footerText: "Entregas expressas em 30 a 60 minutos à sua porta",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?q=85&w=1920&auto=format&fit=crop",
    active: true,
    showEyebrow: true,
    showBadge: true,
    showTitle: true,
    showDescription: true,
    showButtons: true,
    showPrimaryBtn: true,
    showSecondaryBtn: true,
    showFooterText: true,
  },
];

// ==========================================
// MÓDULO A PRAÇA — MARKETPLACE & AFILIADOS
// ==========================================

export interface PracaCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  active: boolean;
  order: number;
  subcategories: string[];
  defaultCommissionRate: number; // % padrão da RESOLVEEXPRESS (ex: 10%)
  affiliateCommissionRate: number; // % padrão de afiliados (ex: 5%)
}

export const INITIAL_PRACA_CATEGORIES: PracaCategory[] = [
  {
    id: "moda-vestuario",
    name: "Moda e Vestuário",
    description: "Roupas masculinas, femininas, infantis, trajes tradicionais e vestuário casual.",
    icon: "Shirt",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 1,
    subcategories: ["Homem", "Mulher", "Criança", "Panos Africanos", "Roupa Desportiva", "Acessórios de Moda"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 5,
  },
  {
    id: "calcados",
    name: "Calçados",
    description: "Sapatilhas, sapatos clássicos, sandálias, chinelos e botas para todas as ocasiões.",
    icon: "Footprints",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 2,
    subcategories: ["Sapatilhas / Sneakers", "Sapatos Sociais", "Sandálias", "Chinelos", "Botas", "Calçado Infantil"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 5,
  },
  {
    id: "beleza-cosmeticos",
    name: "Beleza e Cosméticos",
    description: "Cuidados com a pele, maquilhagem, cabelos crespos e lisos, perfumes e barbearia.",
    icon: "Sparkles",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 3,
    subcategories: ["Maquilhagem", "Cuidados Capilares", "Perfumes", "Skincare", "Barbearia", "Unhas"],
    defaultCommissionRate: 12,
    affiliateCommissionRate: 6,
  },
  {
    id: "electronicos-tecnologia",
    name: "Electrónicos e Tecnologia",
    description: "Portáteis, computadores de secretária, monitores, áudio, som e periféricos.",
    icon: "Laptop",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 4,
    subcategories: ["Computadores Portáteis", "Monitores e TVs", "Colunas e Áudio", "Cabos e Adaptadores", "Impressoras"],
    defaultCommissionRate: 8,
    affiliateCommissionRate: 4,
  },
  {
    id: "telemoveis-acessorios",
    name: "Telemóveis e Acessórios",
    description: "Smartphones, telemóveis básicos, capas protectoras, carregadores rápidos e auriculares.",
    icon: "Smartphone",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 5,
    subcategories: ["Smartphones", "Capas e Películas", "Carregadores e Cabos", "Auriculares e Headphones", "Powerbanks"],
    defaultCommissionRate: 8,
    affiliateCommissionRate: 4,
  },
  {
    id: "casa-decoracao",
    name: "Casa e Decoração",
    description: "Artigos para tornar a sua casa acolhedora: tapetes, quadros, candeeiros e têxteis.",
    icon: "Home",
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 6,
    subcategories: ["Iluminação", "Têxteis de Cama e Banho", "Quadros e Espelhos", "Cortinas", "Vasos e Plantas"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 5,
  },
  {
    id: "moveis",
    name: "Móveis",
    description: "Sofás confortáveis, mesas de jantar, camas de casal e solteiro, roupeiros e secretárias.",
    icon: "Armchair",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 7,
    subcategories: ["Sala de Estar", "Quarto", "Cozinha", "Escritório", "Exterior e Varanda"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 4,
  },
  {
    id: "electrodomesticos",
    name: "Electrodomésticos",
    description: "Frigoríficos, fogões a gás e elétricos, microondas, ferros de engomar e liquidificadores.",
    icon: "Tv",
    image: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 8,
    subcategories: ["Grandes Electrodomésticos", "Pequenos Electrodomésticos", "Climatização", "Ferros e Cuidados da Roupa"],
    defaultCommissionRate: 8,
    affiliateCommissionRate: 4,
  },
  {
    id: "alimentacao-bebidas",
    name: "Alimentação e Bebidas",
    description: "Pratos prontos, frango grelhado, pizzas, bolos caseiros, sobremesas e sumos frescos.",
    icon: "UtensilsCrossed",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 9,
    subcategories: ["Refeições Quentes", "Sobremesas e Padaria", "Sumos e Refrescos", "Churrasco", "Marmitas Diárias"],
    defaultCommissionRate: 12,
    affiliateCommissionRate: 5,
  },
  {
    id: "supermercado-mercearia",
    name: "Supermercado e Mercearia",
    description: "Arroz, massa, óleo, fuba, leite, enlatados, açucar e produtos básicos para a despensa.",
    icon: "ShoppingCart",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 10,
    subcategories: ["Cestas Básicas", "Mercearia Seca", "Lacticínios", "Temperos e Óleos", "Snacks e Bolachas"],
    defaultCommissionRate: 7,
    affiliateCommissionRate: 3,
  },
  {
    id: "higiene-limpeza",
    name: "Higiene e Limpeza",
    description: "Detergentes, desinfetantes, lixívias, sabonetes, papel higiénico e produtos para o lar.",
    icon: "SprayCan",
    image: "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 11,
    subcategories: ["Limpeza Doméstica", "Higiene Pessoal", "Desinfeção", "Lavandaria e Roupas"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 5,
  },
  {
    id: "saude-bem-estar",
    name: "Saúde e Bem-estar",
    description: "Termómetros, medidores de tensão, suplementos alimentares, vitaminas e cuidados pessoais.",
    icon: "HeartPulse",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 12,
    subcategories: ["Primeiros Socorros", "Vitaminas e Suplementos", "Equipamentos de Saúde", "Massagem e Relaxamento"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 5,
  },
  {
    id: "bebes-criancas",
    name: "Bebés e Crianças",
    description: "Fraldas, toalhetes, leite infantil, brinquedos educativos, carrinhos e roupas de recém-nascido.",
    icon: "Baby",
    image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 13,
    subcategories: ["Fraldas e Higiene", "Alimentação de Bebé", "Brinquedos", "Roupas e Calçado Infantil", "Puericultura"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 5,
  },
  {
    id: "desporto-lazer",
    name: "Desporto e Lazer",
    description: "Bolas de futebol, calções, pesos, cordas, material de pesca, campismo e lazer ao ar livre.",
    icon: "Trophy",
    image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 14,
    subcategories: ["Futebol", "Fitness e Ginásio", "Ciclismo", "Pesca e Ar Livre", "Jogos de Tabuleiro"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 5,
  },
  {
    id: "automoveis-acessorios",
    name: "Automóveis e Acessórios",
    description: "Baterias, capas de bancos, óleos lubrificantes, ambientadores, lâmpadas e ferramentas auto.",
    icon: "Car",
    image: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 15,
    subcategories: ["Óleos e Fluidos", "Baterias", "Acessórios de Interior", "Limpeza e Detalhe Auto", "Pneus e Jantes"],
    defaultCommissionRate: 9,
    affiliateCommissionRate: 4,
  },
  {
    id: "materiais-construcao",
    name: "Materiais de Construção",
    description: "Sacos de cimento, tintas, tubos de canalização, fios elétricos, ferramentas e ferragens.",
    icon: "Hammer",
    image: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 16,
    subcategories: ["Cimento e Inertes", "Tintas e Acessórios", "Material Elétrico", "Material de Canalização", "Ferramentas Manuais"],
    defaultCommissionRate: 8,
    affiliateCommissionRate: 3,
  },
  {
    id: "livros-material-escolar",
    name: "Livros e Material Escolar",
    description: "Manuais escolares, cadernos pautados, mochilas, estojos, canetas e literatura geral.",
    icon: "BookOpen",
    image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 17,
    subcategories: ["Manuais Escolares", "Papelaria e Cadernos", "Mochilas e Estojos", "Livros de Literatura", "Material de Desenho"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 5,
  },
  {
    id: "produtos-digitais",
    name: "Produtos Digitais",
    description: "Cursos em vídeo, apostilas em PDF, modelos de documentos e recursos formativos.",
    icon: "Download",
    image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 18,
    subcategories: ["Cursos Online", "E-books e Guias", "Templates e Planilhas", "Softwares e Licenças"],
    defaultCommissionRate: 15,
    affiliateCommissionRate: 10,
  },
  {
    id: "artesanato-produtos-locais",
    name: "Artesanato e Produtos Locais",
    description: "Esculturas em madeira, cestaria do Planalto Central, tecidos artesanais e lembranças de Angola.",
    icon: "Palette",
    image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 19,
    subcategories: ["Esculturas", "Cestaria Tradicional", "Pinturas e Telas", "Lembranças e Souvenirs"],
    defaultCommissionRate: 12,
    affiliateCommissionRate: 6,
  },
  {
    id: "outros-produtos",
    name: "Outros Produtos",
    description: "Artigos variados, utilidades do dia a dia, presentes especiais e novidades diversas.",
    icon: "Package",
    image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 20,
    subcategories: ["Utilidades Diversas", "Presentes e Festas", "Brindes", "Artigos de Época"],
    defaultCommissionRate: 10,
    affiliateCommissionRate: 5,
  },
];

export interface SellerRecord {
  id: string;
  userId: string;
  storeName: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  province: string;
  municipio: string;
  address: string;
  sellerType: "INDIVIDUAL" | "MERCHANT" | "COMPANY";
  nifOrBi: string;
  description: string;
  logo: string;
  bannerImage?: string;
  status: "REGISTO_INICIADO" | "EM_ANALISE" | "DOCS_PENDENTES" | "APROVADO" | "REJEITADO" | "SUSPENSO";
  rejectionReason?: string;
  commissionRate?: number;
  affiliateCommissionRate?: number;
  rating: number;
  totalSalesCount: number;
  totalGrossAOA: number;
  totalPlatformCommissionAOA: number;
  totalAffiliateCommissionAOA: number;
  netBalanceAOA: number;
  pendingBalanceAOA: number;
  bankAccount?: {
    bankName: string;
    iban: string;
    holder: string;
    nif: string;
  };
  createdAt: string;
}

export const INITIAL_SELLERS: SellerRecord[] = [
  {
    id: "seller-praca-01",
    userId: "usr-seller-01",
    storeName: "Boutique Elegância Huambo",
    ownerName: "Dona Esperança Tchissola",
    phone: "923888111",
    whatsapp: "923888111",
    email: "elegancia.huambo@vendedor.ao",
    province: "Huambo",
    municipio: "Huambo",
    address: "Rua do Comércio nº 12, Centro Comercial Huambo",
    sellerType: "MERCHANT",
    nifOrBi: "5409182736",
    description: "Moda executiva, panos africanos autênticos, sapatos e vestidos elegantes para eventos e dia a dia.",
    logo: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=300&q=80",
    status: "APROVADO",
    rating: 4.9,
    totalSalesCount: 18,
    totalGrossAOA: 345000,
    totalPlatformCommissionAOA: 34500,
    totalAffiliateCommissionAOA: 17250,
    netBalanceAOA: 185000,
    pendingBalanceAOA: 35000,
    bankAccount: {
      bankName: "Banco BAI",
      iban: "AO06.0040.0000.8888.7777.6666.1",
      holder: "Esperança Tchissola",
      nif: "5409182736",
    },
    createdAt: "2026-01-15T09:00:00Z",
  },
  {
    id: "seller-praca-02",
    userId: "usr-seller-02",
    storeName: "TechPlanalto Informática",
    ownerName: "Eng. Victoriano Calueque",
    phone: "924333444",
    whatsapp: "924333444",
    email: "techplanalto@vendedor.ao",
    province: "Huambo",
    municipio: "Huambo",
    address: "Av. Norton de Matos, Galerias Planalto Lote 5",
    sellerType: "COMPANY",
    nifOrBi: "5412983745",
    description: "Computadores portáteis recondicionados de alta qualidade, smartphones, carregadores e periféricos com garantia.",
    logo: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=300&q=80",
    status: "APROVADO",
    rating: 4.8,
    totalSalesCount: 24,
    totalGrossAOA: 890000,
    totalPlatformCommissionAOA: 71200,
    totalAffiliateCommissionAOA: 35600,
    netBalanceAOA: 420000,
    pendingBalanceAOA: 85000,
    bankAccount: {
      bankName: "Banco BFA",
      iban: "AO06.0006.0000.3333.4444.5555.2",
      holder: "TechPlanalto Informática Lda",
      nif: "5412983745",
    },
    createdAt: "2026-01-20T11:30:00Z",
  },
  {
    id: "seller-praca-03",
    userId: "usr-seller-03",
    storeName: "Mundo dos Calçados & Ténis Huambo",
    ownerName: "Pedro Kambundi",
    phone: "925666777",
    whatsapp: "925666777",
    email: "mundocalcados@vendedor.ao",
    province: "Huambo",
    municipio: "Huambo",
    address: "Bairro São Pedro, Próximo ao Mercado Municipal",
    sellerType: "INDIVIDUAL",
    nifOrBi: "00459201HA042",
    description: "Sapatilhas modernas, ténis originais e sapatos para crianças e adultos.",
    logo: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80",
    status: "APROVADO",
    rating: 4.7,
    totalSalesCount: 12,
    totalGrossAOA: 210000,
    totalPlatformCommissionAOA: 21000,
    totalAffiliateCommissionAOA: 10500,
    netBalanceAOA: 120000,
    pendingBalanceAOA: 22000,
    createdAt: "2026-02-01T14:15:00Z",
  },
];

export interface AffiliateRecord {
  id: string;
  userId: string;
  code: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  status: "ATIVO" | "EM_ANALISE" | "SUSPENSO";
  defaultCommissionRate?: number;
  totalClicks: number;
  uniqueClicks: number;
  totalOrdersReferred: number;
  totalSalesVolumeAOA: number;
  pendingCommissionAOA: number;
  availableCommissionAOA: number;
  paidCommissionAOA: number;
  bankAccount?: {
    bankName: string;
    iban: string;
    holder: string;
  };
  createdAt: string;
}

export const INITIAL_AFFILIATES: AffiliateRecord[] = [
  {
    id: "aff-001",
    userId: "usr-aff-01",
    code: "AF1024",
    name: "Mateus Afonso",
    phone: "923777888",
    whatsapp: "923777888",
    email: "mateus.afonso@afiliado.ao",
    status: "ATIVO",
    defaultCommissionRate: 5,
    totalClicks: 218,
    uniqueClicks: 164,
    totalOrdersReferred: 9,
    totalSalesVolumeAOA: 185000,
    pendingCommissionAOA: 4500,
    availableCommissionAOA: 14750,
    paidCommissionAOA: 25000,
    bankAccount: {
      bankName: "Banco BAI",
      iban: "AO06.0040.0000.9999.8888.1111.9",
      holder: "Mateus Afonso",
    },
    createdAt: "2026-01-10T08:00:00Z",
  },
  {
    id: "aff-002",
    userId: "usr-aff-02",
    code: "AF2048",
    name: "Helena Cassinda",
    phone: "924111333",
    whatsapp: "924111333",
    email: "helena.cassinda@afiliado.ao",
    status: "ATIVO",
    defaultCommissionRate: 5,
    totalClicks: 142,
    uniqueClicks: 108,
    totalOrdersReferred: 6,
    totalSalesVolumeAOA: 112000,
    pendingCommissionAOA: 2800,
    availableCommissionAOA: 8400,
    paidCommissionAOA: 15000,
    createdAt: "2026-01-25T10:30:00Z",
  },
];

export interface AffiliateLinkRecord {
  id: string;
  affiliateId: string;
  affiliateCode: string;
  targetType: "PRACA_PRODUCT" | "SERVICE" | "CATEGORY" | "GENERAL";
  targetId: string;
  targetTitle: string;
  targetPriceAOA: number;
  commissionPercent: number;
  estimatedCommissionAOA: number;
  url: string;
  clicks: number;
  conversions: number;
  createdAt: string;
}

export const INITIAL_AFFILIATE_LINKS: AffiliateLinkRecord[] = [
  {
    id: "link-001",
    affiliateId: "aff-001",
    affiliateCode: "AF1024",
    targetType: "PRACA_PRODUCT",
    targetId: "PRACA-PROD-01",
    targetTitle: "Vestido Samakaka Tradicional Elegante",
    targetPriceAOA: 24500,
    commissionPercent: 5,
    estimatedCommissionAOA: 1225,
    url: "/praca?prod=PRACA-PROD-01&ref=AF1024",
    clicks: 64,
    conversions: 4,
    createdAt: "2026-02-01T10:00:00Z",
  },
  {
    id: "link-002",
    affiliateId: "aff-001",
    affiliateCode: "AF1024",
    targetType: "SERVICE",
    targetId: "casa--limpeza-geral",
    targetTitle: "Limpeza Geral Residencial (Resolve Casa)",
    targetPriceAOA: 15000,
    commissionPercent: 6,
    estimatedCommissionAOA: 900,
    url: "/pedir/casa--limpeza-geral?ref=AF1024",
    clicks: 88,
    conversions: 3,
    createdAt: "2026-02-05T14:20:00Z",
  },
  {
    id: "link-003",
    affiliateId: "aff-002",
    affiliateCode: "AF2048",
    targetType: "PRACA_PRODUCT",
    targetId: "PRACA-PROD-03",
    targetTitle: "Sapatilhas Desportivas UltraLight Pro",
    targetPriceAOA: 18500,
    commissionPercent: 5,
    estimatedCommissionAOA: 925,
    url: "/praca?prod=PRACA-PROD-03&ref=AF2048",
    clicks: 45,
    conversions: 2,
    createdAt: "2026-02-10T16:00:00Z",
  },
];

export interface AffiliateConversionRecord {
  id: string;
  affiliateId: string;
  affiliateCode: string;
  orderId?: string;
  bookingId?: string;
  itemType: "PRODUCT" | "SERVICE";
  itemId: string;
  itemName: string;
  saleAmountAOA: number;
  affiliateCommissionPercent: number;
  commissionAmountAOA: number;
  platformCommissionAOA: number;
  sellerId?: string;
  sellerNetAOA?: number;
  status: "PENDENTE" | "APROVADO" | "DISPONIVEL" | "PAGO" | "CANCELADO";
  createdAt: string;
  approvedAt?: string;
}

export const INITIAL_AFFILIATE_CONVERSIONS: AffiliateConversionRecord[] = [
  {
    id: "conv-001",
    affiliateId: "aff-001",
    affiliateCode: "AF1024",
    orderId: "ENC-2026-000008",
    itemType: "PRODUCT",
    itemId: "PRACA-PROD-01",
    itemName: "Vestido Samakaka Tradicional Elegante",
    saleAmountAOA: 24500,
    affiliateCommissionPercent: 5,
    commissionAmountAOA: 1225,
    platformCommissionAOA: 2450,
    sellerId: "seller-praca-01",
    sellerNetAOA: 20825,
    status: "DISPONIVEL",
    createdAt: "2026-02-12T15:30:00Z",
    approvedAt: "2026-02-12T17:00:00Z",
  },
  {
    id: "conv-002",
    affiliateId: "aff-001",
    affiliateCode: "AF1024",
    bookingId: "REX-2026-000014",
    itemType: "SERVICE",
    itemId: "casa--limpeza-geral",
    itemName: "Limpeza Geral Residencial",
    saleAmountAOA: 15000,
    affiliateCommissionPercent: 6,
    commissionAmountAOA: 900,
    platformCommissionAOA: 2250,
    status: "DISPONIVEL",
    createdAt: "2026-02-18T09:15:00Z",
    approvedAt: "2026-02-18T12:00:00Z",
  },
  {
    id: "conv-003",
    affiliateId: "aff-002",
    affiliateCode: "AF2048",
    orderId: "ENC-2026-000019",
    itemType: "PRODUCT",
    itemId: "PRACA-PROD-03",
    itemName: "Sapatilhas Desportivas UltraLight Pro",
    saleAmountAOA: 18500,
    affiliateCommissionPercent: 5,
    commissionAmountAOA: 925,
    platformCommissionAOA: 1850,
    sellerId: "seller-praca-03",
    sellerNetAOA: 15725,
    status: "PENDENTE",
    createdAt: "2026-03-01T11:45:00Z",
  },
];

export interface PracaPayoutRequest {
  id: string;
  requesterType: "SELLER" | "AFFILIATE";
  requesterId: string;
  requesterName: string;
  storeOrAffiliateName: string;
  amountAOA: number;
  method: "TRANSFERENCIA_BANCARIA" | "MULTICAIXA_EXPRESS";
  bankName: string;
  iban: string;
  accountHolder: string;
  status: "PENDENTE" | "EM_PROCESSAMENTO" | "PAGO" | "REJEITADO";
  createdAt: string;
  processedAt?: string;
  receiptUrl?: string;
  adminNote?: string;
}

export const INITIAL_PRACA_PAYOUTS: PracaPayoutRequest[] = [
  {
    id: "PAY-PRACA-001",
    requesterType: "SELLER",
    requesterId: "seller-praca-01",
    requesterName: "Dona Esperança Tchissola",
    storeOrAffiliateName: "Boutique Elegância Huambo",
    amountAOA: 75000,
    method: "TRANSFERENCIA_BANCARIA",
    bankName: "Banco BAI",
    iban: "AO06.0040.0000.8888.7777.6666.1",
    accountHolder: "Esperança Tchissola",
    status: "PAGO",
    createdAt: "2026-02-14T10:00:00Z",
    processedAt: "2026-02-15T11:30:00Z",
    receiptUrl: "/uploads/recibo_bai_75000.pdf",
    adminNote: "Transferência executada com sucesso via BAI Directo.",
  },
  {
    id: "PAY-PRACA-002",
    requesterType: "AFFILIATE",
    requesterId: "aff-001",
    requesterName: "Mateus Afonso",
    storeOrAffiliateName: "Afiliado Mateus (AF1024)",
    amountAOA: 25000,
    method: "MULTICAIXA_EXPRESS",
    bankName: "Multicaixa Express (923777888)",
    iban: "AO06.0040.0000.9999.8888.1111.9",
    accountHolder: "Mateus Afonso",
    status: "PAGO",
    createdAt: "2026-02-20T16:00:00Z",
    processedAt: "2026-02-21T09:00:00Z",
    adminNote: "Enviado por Multicaixa Express com comprovativo.",
  },
  {
    id: "PAY-PRACA-003",
    requesterType: "SELLER",
    requesterId: "seller-praca-02",
    requesterName: "Eng. Victoriano Calueque",
    storeOrAffiliateName: "TechPlanalto Informática",
    amountAOA: 150000,
    method: "TRANSFERENCIA_BANCARIA",
    bankName: "Banco BFA",
    iban: "AO06.0006.0000.3333.4444.5555.2",
    accountHolder: "TechPlanalto Informática Lda",
    status: "PENDENTE",
    createdAt: "2026-03-02T14:30:00Z",
    adminNote: "Aguardando lote de liquidações bancárias da semana.",
  },
];

export interface PracaSettings {
  defaultPlatformCommission: number; // e.g. 10 (%)
  defaultAffiliateCommission: number; // e.g. 5 (%)
  affiliateCommissionPayer: "SELLER" | "PLATFORM" | "SPLIT";
  minPayoutAmountAOA: number; // e.g. 10000 Kz
  attributionWindowDays: number; // e.g. 30
  autoApproveSellers: boolean;
  autoApproveProducts: boolean;
}

export const INITIAL_PRACA_SETTINGS: PracaSettings = {
  defaultPlatformCommission: 10,
  defaultAffiliateCommission: 5,
  affiliateCommissionPayer: "SELLER",
  minPayoutAmountAOA: 10000,
  attributionWindowDays: 30,
  autoApproveSellers: false,
  autoApproveProducts: true,
};

export const INITIAL_PRACA_PRODUCTS: Product[] = [
  {
    id: "PRACA-PROD-01",
    name: "Vestido Samakaka Tradicional Elegante",
    description: "Vestido com corte moderno e tecido autêntico Samakaka de alta gramagem. Ideal para cerimónias, casamentos e ocasiões festivas.",
    priceAOA: 24500,
    promotionalPriceAOA: 21900,
    available: true,
    stock: 14,
    sellerName: "Boutique Elegância Huambo",
    sellerId: "seller-praca-01",
    sellerType: "PRACA_SELLER",
    category: "Moda e Vestuário",
    pracaCategoryId: "moda-vestuario",
    subcategory: "Mulher",
    brand: "Samakaka Design",
    sku: "MOD-SAM-001",
    condition: "NOVO",
    isPraca: true,
    platformCommissionRate: 10,
    affiliateCommissionRate: 5,
    image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=700&q=80",
    deliveryLocation: "Huambo (Entregas ao domicílio em 45 min)",
    estimatedDelivery: "30 a 60 minutos",
    unit: "unidade",
    rating: 4.9,
    reviewsCount: 16,
    badge: "Destaque",
    variations: [{ name: "Tamanho", options: ["S", "M", "L", "XL"] }],
    deliveryOption: "BOTH",
    status: "ATIVO",
  },
  {
    id: "PRACA-PROD-02",
    name: "Computador Portátil HP EliteBook G6 Core i5",
    description: "Portátil profissional recondicionado grau A+, Intel Core i5 8ª Geração, 16GB RAM, 256GB SSD NVMe, ecrã Full HD 14'', teclado retroiluminado e bateria com 5h de autonomia.",
    priceAOA: 265000,
    promotionalPriceAOA: 245000,
    available: true,
    stock: 6,
    sellerName: "TechPlanalto Informática",
    sellerId: "seller-praca-02",
    sellerType: "PRACA_SELLER",
    category: "Electrónicos e Tecnologia",
    pracaCategoryId: "electronicos-tecnologia",
    subcategory: "Computadores Portáteis",
    brand: "HP",
    sku: "TECH-HP-840G6",
    condition: "USADO",
    isPraca: true,
    platformCommissionRate: 8,
    affiliateCommissionRate: 4,
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=80",
    deliveryLocation: "Huambo e Caála (Entrega segura com talão)",
    estimatedDelivery: "Hoje até às 17h",
    unit: "unidade",
    warranty: "6 meses de garantia directa",
    rating: 4.8,
    reviewsCount: 22,
    badge: "Garantia 6 Meses",
    deliveryOption: "BOTH",
    status: "ATIVO",
  },
  {
    id: "PRACA-PROD-03",
    name: "Sapatilhas Desportivas UltraLight Pro",
    description: "Sapatilhas leves com sola de absorção de impacto, tecido respirável e design moderno para caminhadas, corrida e lazer.",
    priceAOA: 18500,
    available: true,
    stock: 20,
    sellerName: "Mundo dos Calçados & Ténis Huambo",
    sellerId: "seller-praca-03",
    sellerType: "PRACA_SELLER",
    category: "Calçados",
    pracaCategoryId: "calcados",
    subcategory: "Sapatilhas / Sneakers",
    brand: "UltraLight",
    sku: "CAL-ULT-02",
    condition: "NOVO",
    isPraca: true,
    platformCommissionRate: 10,
    affiliateCommissionRate: 5,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80",
    deliveryLocation: "Huambo (Todos os bairros)",
    estimatedDelivery: "30 a 60 minutos",
    unit: "par",
    rating: 4.7,
    reviewsCount: 11,
    variations: [{ name: "Tamanho", options: ["39", "40", "41", "42", "43", "44"] }],
    deliveryOption: "BOTH",
    status: "ATIVO",
  },
  {
    id: "PRACA-PROD-04",
    name: "Smartphone Samsung Galaxy A15 128GB",
    description: "Ecrã Super AMOLED 6.5'', Câmara Tripla 50MP, Bateria potente 5000mAh com carregamento rápido e suporte a Dual SIM angolano (Unitel/Africell/Movicel).",
    priceAOA: 135000,
    promotionalPriceAOA: 125000,
    available: true,
    stock: 9,
    sellerName: "TechPlanalto Informática",
    sellerId: "seller-praca-02",
    sellerType: "PRACA_SELLER",
    category: "Telemóveis e Acessórios",
    pracaCategoryId: "telemoveis-acessorios",
    subcategory: "Smartphones",
    brand: "Samsung",
    sku: "TEL-SAM-A15",
    condition: "NOVO",
    isPraca: true,
    platformCommissionRate: 8,
    affiliateCommissionRate: 4,
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=700&q=80",
    deliveryLocation: "Huambo e Províncias Vizinhas",
    estimatedDelivery: "45 a 90 minutos",
    unit: "unidade",
    warranty: "1 ano de garantia oficial",
    rating: 4.9,
    reviewsCount: 34,
    badge: "Mais Vendido",
    deliveryOption: "BOTH",
    status: "ATIVO",
  },
  {
    id: "PRACA-PROD-05",
    name: "Sofá Retrátil 3 Lugares Conforto Planalto",
    description: "Sofá espaçoso de 3 lugares com assentos retráteis e encosto reclinável, estofado em tecido suede aveludado cinzento, estrutura em madeira de eucalipto tratada.",
    priceAOA: 195000,
    promotionalPriceAOA: 175000,
    available: true,
    stock: 4,
    sellerName: "Boutique Elegância Huambo",
    sellerId: "seller-praca-01",
    sellerType: "PRACA_SELLER",
    category: "Móveis",
    pracaCategoryId: "moveis",
    subcategory: "Sala de Estar",
    brand: "Planalto Móveis",
    sku: "MOV-SOF-03",
    condition: "NOVO",
    isPraca: true,
    platformCommissionRate: 10,
    affiliateCommissionRate: 4,
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=80",
    deliveryLocation: "Huambo (Entrega com carrinha e montagem incluída)",
    estimatedDelivery: "Até 24 horas",
    unit: "conjunto",
    rating: 5.0,
    reviewsCount: 8,
    badge: "Frete Especial",
    deliveryOption: "DELIVERY",
    status: "ATIVO",
  },
  {
    id: "PRACA-PROD-06",
    name: "Frigorífico Combinado Defrost 240L",
    description: "Frigorífico económico com congelador superior, prateleiras em vidro temperado, gaveta de legumes e baixo consumo energético.",
    priceAOA: 285000,
    available: true,
    stock: 5,
    sellerName: "TechPlanalto Informática",
    sellerId: "seller-praca-02",
    sellerType: "PRACA_SELLER",
    category: "Electrodomésticos",
    pracaCategoryId: "electrodomesticos",
    subcategory: "Grandes Electrodomésticos",
    brand: "Hisense",
    sku: "ELEC-FRIG-240",
    condition: "NOVO",
    isPraca: true,
    platformCommissionRate: 8,
    affiliateCommissionRate: 3,
    image: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=700&q=80",
    deliveryLocation: "Huambo (Entrega com equipa técnica)",
    estimatedDelivery: "Mesmo dia (até 18h)",
    unit: "unidade",
    warranty: "1 ano de garantia",
    rating: 4.8,
    reviewsCount: 15,
    deliveryOption: "BOTH",
    status: "ATIVO",
  },
  {
    id: "PRACA-PROD-07",
    name: "Escultura Tradicional Pensador em Pau-Preto",
    description: "Obra de arte entalhada à mão em madeira nobre de pau-preto por mestre artesão do Huambo. Símbolo nacional de sabedoria e reflexão angolana.",
    priceAOA: 32000,
    promotionalPriceAOA: 28000,
    available: true,
    stock: 7,
    sellerName: "Boutique Elegância Huambo",
    sellerId: "seller-praca-01",
    sellerType: "PRACA_SELLER",
    category: "Artesanato e Produtos Locais",
    pracaCategoryId: "artesanato-produtos-locais",
    subcategory: "Esculturas",
    brand: "Artesãos do Huambo",
    sku: "ART-PEN-01",
    condition: "NOVO",
    isPraca: true,
    platformCommissionRate: 12,
    affiliateCommissionRate: 6,
    image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=700&q=80",
    deliveryLocation: "Huambo e envio para todas as províncias",
    estimatedDelivery: "30 a 60 minutos",
    unit: "peça",
    rating: 5.0,
    reviewsCount: 19,
    badge: "100% Artesanal",
    deliveryOption: "BOTH",
    status: "ATIVO",
  },
];

// ==========================================
// MÓDULO IMPORTAÇÃO — CARTÕES VIRTUAIS & COTAÇÕES
// ==========================================

export interface VirtualCardRequest {
  id: string; // e.g. VCR-001
  customerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  province: string;
  municipio: string;
  purpose: "COMPRAS_PESSOAIS" | "ASSINATURAS_DIGITAIS" | "COMERCIO_IMPORTACAO" | "VIAGENS" | "OUTRO";
  preferredCardProvider?: "WISE" | "PYYPL" | "REDOTPAY" | "MULTICAIXA_INTERNACIONAL" | "QUALQUER_RECOMENDADO";
  notes?: string;
  status: "PENDENTE" | "EM_ATENDIMENTO" | "CONCLUIDO" | "CANCELADO";
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export const INITIAL_VIRTUAL_CARD_REQUESTS: VirtualCardRequest[] = [
  {
    id: "VCR-2026-0001",
    customerName: "Carlos Alberto Ndala",
    phone: "923444555",
    whatsapp: "923444555",
    email: "carlos.ndala@exemplo.ao",
    province: "Huambo",
    municipio: "Huambo",
    purpose: "ASSINATURAS_DIGITAIS",
    preferredCardProvider: "PYYPL",
    notes: "Preciso de um cartão internacional para pagar Netflix, Canva Pro e cursos online sem complicações.",
    status: "EM_ATENDIMENTO",
    adminNotes: "Cliente contactado no WhatsApp. Apoiado no processo de verificação de identidade oficial.",
    createdAt: "2026-02-18T10:30:00Z",
  },
  {
    id: "VCR-2026-0002",
    customerName: "Mariana Chivela",
    phone: "924888999",
    whatsapp: "924888999",
    email: "mariana.chivela@exemplo.ao",
    province: "Huambo",
    municipio: "Caála",
    purpose: "COMERCIO_IMPORTACAO",
    preferredCardProvider: "WISE",
    notes: "Quero fazer compras na Shein e AliExpress para revender na minha loja de roupa.",
    status: "CONCLUIDO",
    adminNotes: "Consultoria concluída com sucesso. Cartão operacional.",
    createdAt: "2026-02-20T14:15:00Z",
  },
];

export interface ImportQuoteRequest {
  id: string; // e.g. IMP-2026-000001
  customerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  productName: string;
  productUrl?: string;
  photoUrl?: string;
  quantity: number;
  originCountryOrStore: string; // e.g. "China / Alibaba", "EUA / Amazon", "Portugal", "Dubai"
  deliveryProvince: string;
  deliveryMunicipio: string;
  deliveryAddress?: string;
  specifications?: string;
  status:
    | "COTACAO_PENDENTE"
    | "COTACAO_ENVIADA"
    | "APROVADA_PELO_CLIENTE"
    | "ENCOMENDA_PAGA"
    | "EM_TRANSITO_INTERNACIONAL"
    | "NA_ALFANDEGA"
    | "ENTREGUE"
    | "CANCELADA";
  // Quote breakdown calculated by Resolve Express
  productPriceOriginal?: string; // e.g. "$180 USD"
  productPriceAOA?: number;
  internationalFreightAOA?: number;
  customsAndTaxesAOA?: number;
  handlingFeeAOA?: number;
  estimatedDays?: string; // e.g. "12 a 18 dias úteis"
  totalQuotedAOA?: number;
  quoteNotes?: string;
  createdAt: string;
  quotedAt?: string;
  approvedAt?: string;
}

export const INITIAL_IMPORT_QUOTES: ImportQuoteRequest[] = [
  {
    id: "IMP-2026-000001",
    customerName: "Dr. Frederico Sambango",
    phone: "923111888",
    whatsapp: "923111888",
    email: "dr.sambango@clinica.ao",
    productName: "Esterilizador Autoclave Odontológico 18L",
    productUrl: "https://www.alibaba.com/product-detail/Dental-Autoclave-Steam-Sterilizer_16001234567.html",
    photoUrl: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80",
    quantity: 1,
    originCountryOrStore: "China / Alibaba",
    deliveryProvince: "Huambo",
    deliveryMunicipio: "Huambo",
    deliveryAddress: "Bairro da Chiva, Clínica Médica do Planalto",
    specifications: "Voltagem 220V/50Hz com certificação CE e manual em português ou inglês.",
    status: "COTACAO_ENVIADA",
    productPriceOriginal: "$620 USD",
    productPriceAOA: 589000,
    internationalFreightAOA: 145000,
    customsAndTaxesAOA: 88000,
    handlingFeeAOA: 45000,
    estimatedDays: "15 a 22 dias úteis via aéreo expresso",
    totalQuotedAOA: 867000,
    quoteNotes: "Inclui desalfandegamento no Aeroporto 4 de Fevereiro e transporte seguro terrestre até à clínica no Huambo.",
    createdAt: "2026-02-25T09:00:00Z",
    quotedAt: "2026-02-25T16:00:00Z",
  },
  {
    id: "IMP-2026-000002",
    customerName: "António Chipenda",
    phone: "925777333",
    whatsapp: "925777333",
    email: "antonio.chipenda@mecanica.ao",
    productName: "Kit Scanner de Diagnóstico Automóvel Profissional OBD2",
    productUrl: "https://www.amazon.com/dp/B08VNF888",
    photoUrl: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=600&q=80",
    quantity: 2,
    originCountryOrStore: "EUA / Amazon",
    deliveryProvince: "Huambo",
    deliveryMunicipio: "Huambo",
    deliveryAddress: "Oficina AutoPlan, Rua do Comércio",
    specifications: "Atualização vitalícia com suporte a viaturas Toyota, Mitsubishi e Hyundai.",
    status: "APROVADA_PELO_CLIENTE",
    productPriceOriginal: "$350 USD",
    productPriceAOA: 332500,
    internationalFreightAOA: 68000,
    customsAndTaxesAOA: 42000,
    handlingFeeAOA: 30000,
    estimatedDays: "10 a 14 dias úteis",
    totalQuotedAOA: 472500,
    quoteNotes: "Cotação aprovada pelo cliente. Aguardando chegada ao armazém de trânsito em Lisboa.",
    createdAt: "2026-02-27T11:20:00Z",
    quotedAt: "2026-02-27T17:30:00Z",
    approvedAt: "2026-02-28T09:10:00Z",
  },
];

// ==========================================
// MÓDULO INTERMEDIÁRIO — BENS MATERIAIS & NEGOCIAÇÃO
// ==========================================

export interface IntermediaryCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  active: boolean;
  order: number;
  subcategories: string[];
  suggestedCommissionPercent: number; // e.g. 3% for real estate/cars, 5% for equipment
}

export const INITIAL_INTERMEDIARY_CATEGORIES: IntermediaryCategory[] = [
  {
    id: "casas-apartamentos",
    name: "Casas e Apartamentos",
    description: "Vivendas T3/T4, apartamentos residenciais, moradias fechadas e propriedades no Huambo e outras províncias.",
    icon: "Home",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 1,
    subcategories: ["Vivendas", "Apartamentos", "Casas em Condomínio", "Edifícios Comerciais", "Quintas e Casas de Campo"],
    suggestedCommissionPercent: 3,
  },
  {
    id: "terrenos",
    name: "Terrenos e Lotes",
    description: "Terrenos urbanizados, parcelas para construção, lotes agro-industriais e quintas com direito de superfície.",
    icon: "Map",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 2,
    subcategories: ["Lotes Urbanos", "Terrenos Agrícolas", "Parcelas Comerciais", "Espaços Industriais"],
    suggestedCommissionPercent: 3,
  },
  {
    id: "automoveis",
    name: "Automóveis e Viaturas",
    description: "Carrinhas 4x4, SUV, viaturas ligeiras, autocarros de passageiros e viaturas de carga.",
    icon: "Car",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 3,
    subcategories: ["Pickups e 4x4", "SUV e Carrinhas Familiares", "Citadinos Económicos", "Camiões e Furgões de Carga"],
    suggestedCommissionPercent: 3,
  },
  {
    id: "motorizadas",
    name: "Motorizadas e Motos",
    description: "Motos de trabalho, triciclos de carga (Kupapatas), scooters e motas de transporte rápido.",
    icon: "Bike",
    image: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 4,
    subcategories: ["Motos de Trabalho 125/150cc", "Triciclos de Carga", "Scooters Urbanas", "Motos Todo-o-Terreno"],
    suggestedCommissionPercent: 5,
  },
  {
    id: "maquinas-industriais",
    name: "Máquinas e Equipamentos Industriais",
    description: "Geradores industriais de alta potência, compressores de ar, tornos mecânicos e prensas.",
    icon: "Cog",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 5,
    subcategories: ["Geradores Diesel", "Compressores Industriais", "Máquinas de Soldadura", "Tornos e Ferramentas Pesadas"],
    suggestedCommissionPercent: 5,
  },
  {
    id: "equipamentos-agricolas",
    name: "Equipamentos Agrícolas",
    description: "Tratores agrícolas, reboques, motobombas de irrigação, debulhadoras e alfaias agrícolas.",
    icon: "Tractor",
    image: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 6,
    subcategories: ["Tratores e Reboques", "Sistemas de Irrigação / Bombas", "Fresas e Charruas", "Moageiras de Milho e Fuba"],
    suggestedCommissionPercent: 4,
  },
  {
    id: "maquinas-padaria",
    name: "Máquinas de Padaria e Restauração",
    description: "Fornos industriais a gás/lenha/elétricos, amassadeiras espirais, batedeiras planetárias e vitrines térmicas.",
    icon: "Utensils",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 7,
    subcategories: ["Fornos Industriais", "Amassadeiras e Misturadoras", "Laminadoras e Divisoras", "Bancas de Inox e Fritadeiras"],
    suggestedCommissionPercent: 5,
  },
  {
    id: "mobiliario-escritorio",
    name: "Mobiliário e Equipamento de Escritório",
    description: "Conjuntos de secretárias executivas, cadeiras ergonómicas, estantes e cofres de segurança.",
    icon: "Armchair",
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 8,
    subcategories: ["Secretárias Executivas", "Cadeiras de Escritório", "Estantes e Armários Metálicos", "Cofres e Ficheiros"],
    suggestedCommissionPercent: 5,
  },
  {
    id: "eletrodomesticos-bens",
    name: "Eletrodomésticos Pesados",
    description: "Arcas frigoríficas de grande capacidade, fogões industriais e aparelhos de ar condicionado.",
    icon: "Tv",
    image: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 9,
    subcategories: ["Arcas Frigoríficas Comerciais", "Aparelhos de AC", "Fogões a Gás 6 Bocas", "Máquinas de Lavar 15kg+"],
    suggestedCommissionPercent: 5,
  },
  {
    id: "computadores-tecnologia",
    name: "Computadores e Servidores",
    description: "Servidores em torre e rack, centrais telefónicas, lotes de computadores completos para empresas.",
    icon: "Laptop",
    image: "https://images.unsplash.com/photo-1587831990711-23ca6441447b?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 10,
    subcategories: ["Servidores e Racks", "Lotes de Computadores", "Centrais PABX / Redes", "Impressoras Multifunções A3"],
    suggestedCommissionPercent: 5,
  },
  {
    id: "materiais-construcao",
    name: "Materiais e Equipamentos de Construção",
    description: "Betoneiras a gasóleo, andaimes metálicos, vibradores de betão e ferramentas pesadas de obra.",
    icon: "Hammer",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 11,
    subcategories: ["Betoneiras e Misturadores", "Andaimes e Escoras", "Equipamentos de Elevação", "Ferramentas Elétricas de Obra"],
    suggestedCommissionPercent: 5,
  },
  {
    id: "outros-bens",
    name: "Outros Bens Materiais",
    description: "Outros equipamentos produtivos, estruturas metálicas, contentores marítimos e bens materiais diversos.",
    icon: "Package",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    active: true,
    order: 12,
    subcategories: ["Contentores 20ft e 40ft", "Estruturas Metálicas", "Tendas de Eventos", "Bens Diversos"],
    suggestedCommissionPercent: 5,
  },
];

export interface IntermediaryListing {
  id: string; // e.g. INT-0001
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  subcategory?: string;
  condition: "NOVO" | "USADO";
  priceAOA: number;
  priceNegotiable: boolean;
  province: string;
  municipio: string;
  bairro?: string;
  images: string[];
  features: Record<string, string>; // e.g. { "Ano": "2021", "Quilometragem": "65.000 km", "Combustível": "Gasóleo" }
  sellerName: string;
  sellerPhone: string;
  sellerWhatsapp: string;
  sellerEmail?: string;
  sellerType: "PROPRIETARIO" | "EMPRESA" | "COMERCIANTE" | "REVENDEDOR";
  status:
    | "RASCUNHO"
    | "PENDENTE_APROVACAO"
    | "PUBLICADO"
    | "OCULTO"
    | "VENDIDO"
    | "ARQUIVADO"
    | "REJEITADO";
  rejectionReason?: string;
  featuredHome?: boolean;
  verifiedBadge?: boolean;
  inspectionStatus?: "NAO_INSPECIONADO" | "PENDENTE_VISTORIA" | "VISTORIA_APROVADA" | "VISTORIA_REPROVADA";
  viewsCount: number;
  intermediationRequestedCount: number;
  createdAt: string;
  updatedAt?: string;
}

export const INITIAL_INTERMEDIARY_LISTINGS: IntermediaryListing[] = [
  {
    id: "INT-2026-0001",
    title: "Vivenda T4 Moderna com Quintal Espaçoso e Garagem",
    description:
      "Excelente moradia no Bairro da Chiva, Huambo. Composta por 1 suite master com closet, 3 quartos amplos, 2 casas de banho de apoio, sala comum em open-space com lareira, cozinha equipada com armários embutidos e despensa. Quintal com capacidade para 4 viaturas, tanque de água subterrâneo de 15.000 litros com eletrobomba e cerca elétrica ativa.",
    categoryId: "casas-apartamentos",
    categoryName: "Casas e Apartamentos",
    subcategory: "Vivendas",
    condition: "USADO",
    priceAOA: 48000000,
    priceNegotiable: true,
    province: "Huambo",
    municipio: "Huambo",
    bairro: "Chiva",
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1000&q=80",
    ],
    features: {
      "Tipologia": "T4 (1 Suite + 3 Quartos)",
      "Área do Lote": "25 x 30 metros (750 m²)",
      "Documentação": "Direito de Superfície e Croquis de Localização",
      "Água e Luz": "Rede pública + Tanque 15.000L",
      "Segurança": "Muro alto com cerca elétrica",
    },
    sellerName: "Eng. Alberto Sambala",
    sellerPhone: "923555222",
    sellerWhatsapp: "923555222",
    sellerType: "PROPRIETARIO",
    status: "PUBLICADO",
    featuredHome: true,
    viewsCount: 148,
    intermediationRequestedCount: 4,
    createdAt: "2026-02-15T09:30:00Z",
  },
  {
    id: "INT-2026-0002",
    title: "Carrinha Toyota Hilux D4D 4x4 Cabine Dupla 2021",
    description:
      "Viatura em excelente estado de conservação, manutenção sempre feita na concessionária oficial. Motor 2.8 D4D potente e económico, tração 4x4 funcional com redutora, caixa manual de 6 velocidades, estofos em couro, ar condicionado gela a 100%, pneus novos todo-terreno e mata-vacas frontal com guincho instalado.",
    categoryId: "automoveis",
    categoryName: "Automóveis e Viaturas",
    subcategory: "Pickups e 4x4",
    condition: "USADO",
    priceAOA: 26500000,
    priceNegotiable: true,
    province: "Huambo",
    municipio: "Huambo",
    bairro: "São Pedro",
    images: [
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80",
    ],
    features: {
      "Ano de Fabrico": "2021",
      "Quilometragem": "58.000 km reais",
      "Combustível": "Gasóleo (Diesel)",
      "Transmissão": "Manual 6 Velocidades (4x4)",
      "Matrícula": "LD (Luanda / Transferível)",
    },
    sellerName: "Comércio & Frotas Planalto Lda",
    sellerPhone: "924111777",
    sellerWhatsapp: "924111777",
    sellerType: "EMPRESA",
    status: "PUBLICADO",
    featuredHome: true,
    viewsCount: 312,
    intermediationRequestedCount: 7,
    createdAt: "2026-02-20T11:00:00Z",
  },
  {
    id: "INT-2026-0003",
    title: "Forno Rotativo Industrial de Padaria 200 Pães com Amassadeira 50kg",
    description:
      "Linha completa de padaria semi-nova. Forno rotativo de 200 pães por fornada a gasóleo e elétrico (queimador Riello italiano), acompanha 3 carros em inox e 45 tabuleiros perfurados. Inclui amassadeira espiral de 50kg de farinha em aço inoxidável e divisora mecânica de 30 unidades.",
    categoryId: "maquinas-padaria",
    categoryName: "Máquinas de Padaria e Restauração",
    subcategory: "Fornos Industriais",
    condition: "USADO",
    priceAOA: 14800000,
    priceNegotiable: true,
    province: "Huambo",
    municipio: "Huambo",
    bairro: "Cidade Alta",
    images: [
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1000&q=80",
    ],
    features: {
      "Capacidade": "200 pães por cozedura (12 min)",
      "Alimentação": "Queimador a Gasóleo + Trifásico 380V",
      "Acessórios": "3 Carros giratórios + 45 Tabuleiros",
      "Estado Mecânico": "Revisão efetuada / Funcionamento a 100%",
    },
    sellerName: "Padaria Central do Planalto",
    sellerPhone: "926999444",
    sellerWhatsapp: "926999444",
    sellerType: "COMERCIANTE",
    status: "PUBLICADO",
    featuredHome: true,
    viewsCount: 198,
    intermediationRequestedCount: 5,
    createdAt: "2026-02-22T14:40:00Z",
  },
  {
    id: "INT-2026-0004",
    title: "Trator Agrícola Massey Ferguson 290 4x4 com Grade de 18 Discos",
    description:
      "Trator agrícola de grande fiabilidade mecânica e fácil manutenção. Motor Perkins 4 cilindros em estado impecável, tração 4x4, tomada de força traseira operacional e bomba hidráulica potente. Inclui grade aradora de 18 discos e barra de tração original.",
    categoryId: "equipamentos-agricolas",
    categoryName: "Equipamentos Agrícolas",
    subcategory: "Tratores e Reboques",
    condition: "USADO",
    priceAOA: 19500000,
    priceNegotiable: true,
    province: "Huambo",
    municipio: "Bailundo",
    bairro: "Zona Agrícola",
    images: [
      "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=1000&q=80",
    ],
    features: {
      "Marca / Modelo": "Massey Ferguson 290",
      "Potência": "85 CV",
      "Tração": "4x4 Traçado",
      "Horas de Uso": "3.200 Horas",
      "Alfaias Inclusas": "Grade Aradora 18 discos",
    },
    sellerName: "Cooperativa Agrícola do Bailundo",
    sellerPhone: "923118999",
    sellerWhatsapp: "923118999",
    sellerType: "EMPRESA",
    status: "PUBLICADO",
    featuredHome: true,
    viewsCount: 245,
    intermediationRequestedCount: 6,
    createdAt: "2026-02-26T10:15:00Z",
  },
];

export interface IntermediaryNegotiation {
  id: string; // e.g. NEG-2026-000001
  listingId: string;
  listingTitle: string;
  listingPriceAOA: number;
  buyerName: string;
  buyerPhone: string;
  buyerWhatsapp: string;
  sellerName: string;
  sellerPhone: string;
  offeredPriceAOA: number;
  agreedCommissionAOA?: number;
  commissionPayer?: "BUYER" | "SELLER" | "SPLIT";
  inspectionRequested: boolean;
  escrowRequested: boolean;
  status:
    | "PROPOSTA_INICIADA"
    | "EM_ANALISE_RESOLVE"
    | "VISTORIA_AGENDADA"
    | "ACORDO_FIRMADO"
    | "CONCLUIDA"
    | "CANCELADA";
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export const INITIAL_INTERMEDIARY_NEGOTIATIONS: IntermediaryNegotiation[] = [
  {
    id: "NEG-2026-000001",
    listingId: "INT-2026-0002",
    listingTitle: "Carrinha Toyota Hilux D4D 4x4 Cabine Dupla 2021",
    listingPriceAOA: 26500000,
    buyerName: "Manuel Gonçalves",
    buyerPhone: "923777000",
    buyerWhatsapp: "923777000",
    sellerName: "Comércio & Frotas Planalto Lda",
    sellerPhone: "924111777",
    offeredPriceAOA: 25000000,
    agreedCommissionAOA: 750000,
    commissionPayer: "SPLIT",
    inspectionRequested: true,
    escrowRequested: true,
    status: "VISTORIA_AGENDADA",
    notes: "Vistoria mecânica presencial agendada com técnico da Resolve Express para quinta-feira às 10h.",
    createdAt: "2026-02-28T16:00:00Z",
  },
];


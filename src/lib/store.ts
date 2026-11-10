import { useState, useEffect, useCallback } from "react";
import {
  DEFAULT_FEATURED,
  INITIAL_PRODUCTS,
  CATEGORIES,
  allServices as baseAllServices,
  type Category,
  type Service,
  type Product,
  type HeroBanner,
  DEFAULT_HERO_BANNERS,
  type PracaCategory,
  INITIAL_PRACA_CATEGORIES,
  type SellerRecord,
  INITIAL_SELLERS,
  type AffiliateRecord,
  INITIAL_AFFILIATES,
  type AffiliateLinkRecord,
  INITIAL_AFFILIATE_LINKS,
  type AffiliateConversionRecord,
  INITIAL_AFFILIATE_CONVERSIONS,
  type PracaPayoutRequest,
  INITIAL_PRACA_PAYOUTS,
  type PracaSettings,
  INITIAL_PRACA_SETTINGS,
  INITIAL_PRACA_PRODUCTS,
  type VirtualCardRequest,
  INITIAL_VIRTUAL_CARD_REQUESTS,
  type ImportQuoteRequest,
  INITIAL_IMPORT_QUOTES,
  type IntermediaryCategory,
  INITIAL_INTERMEDIARY_CATEGORIES,
  type IntermediaryListing,
  INITIAL_INTERMEDIARY_LISTINGS,
  type IntermediaryNegotiation,
  INITIAL_INTERMEDIARY_NEGOTIATIONS,
} from "./data";
import {
  isSupabaseConfigured,
  getSupabasePlatformSettings,
  saveSupabasePlatformSettings,
} from "./supabase";

export type { ImportQuoteRequest, IntermediaryListing, IntermediaryNegotiation, VirtualCardRequest };

export type UserRole =
  | "CUSTOMER"
  | "EMPLOYEE"
  | "PARTNER"
  | "BUSINESS_PARTNER"
  | "PROFESSIONAL"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "SELLER"
  | "AFFILIATE"
  | "OPERATIONS"
  | "CUSTOMER_SUPPORT";
export type CurrencyCode = "AOA" | "USD" | "EUR";
export type LanguageCode = "PT" | "EN" | "ES" | "FR";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  province: string;
  municipio: string;
  bairro?: string;
  address?: string;
  reference?: string;
  companyName?: string;
  nif?: string;
  specialty?: string;
  active: boolean;
  avatar?: string;
  walletBalanceAOA?: number;
  createdAt?: string;
  lastLogin?: string;
  // Praça Extensions
  isSeller?: boolean;
  sellerId?: string;
  isAffiliate?: boolean;
  affiliateCode?: string;
}

export interface BookingRecord {
  id: string;
  serviceId: string;
  service: string;
  category: string;
  provider: "COMPANY_OWNED" | "INDEPENDENT_PARTNER" | "BUSINESS_PARTNER";
  qty: number;
  unit: string;
  details: string;
  photos: string[];
  address: string;
  ref: string;
  date: string;
  slot: string;
  recurrence: string;
  payment: string;
  total: number | null;
  status: "Recebido" | "Confirmado" | "Em curso" | "Concluído" | "Cancelado";
  paymentStatus: string;
  paymentReference?: string;
  proofOfPayment?: string;
  paymentDetails?: Record<string, any>;
  customer: string;
  phone: string;
  assignedTo?: string;
  assignedType?: "EMPLOYEE" | "PARTNER";
  partnerId?: string;
  createdAt: string;
  history: Array<{ at: string; status: string; note?: string }>;
  rating?: number;
  reviewComment?: string;
  // Affiliate Tracking
  affiliateCode?: string;
  affiliateCommissionAOA?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ProductOrderRecord {
  id: string; // e.g. ENC-2026-000001
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  subtotalAOA: number;
  deliveryFeeAOA: number;
  discountAOA: number;
  totalAOA: number;
  deliveryAddress: string;
  deliveryBairro: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference?: string;
  proofOfPayment?: string;
  paymentDetails?: Record<string, any>;
  orderStatus:
    | "Recebida"
    | "Confirmada"
    | "Em preparação"
    | "A caminho"
    | "Entregue"
    | "Cancelada";
  createdAt: string;
  estimatedDelivery: string;
  sellerNames: string[];
  // Praça & Affiliate Tracking
  sellerId?: string;
  affiliateCode?: string;
  affiliateCommissionAOA?: number;
  platformCommissionAOA?: number;
  sellerNetAOA?: number;
}

export interface PartnerCompanyRecord {
  id: string;
  commercialName: string;
  socialReason: string;
  nif: string;
  manager: string;
  phone: string;
  email: string;
  province: string;
  municipio: string;
  address: string;
  activityCategory: string;
  description: string;
  logo?: string;
  status: "Pendente" | "Aprovado" | "Rejeitado";
  createdAt: string;
}

export interface ApplicationRecord {
  id?: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  skills: string[];
  exp: string;
  refs: string;
  idDoc?: string;
  photo: string;
  certs: string[];
  at: string;
  status: "Pendente" | "Aprovado" | "Rejeitado";
}

export interface EmployeeRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  department: string;
  city: string;
  professionalId: string;
  admissionDate: string;
  active: boolean;
}

export type SupportTicketCategory =
  | "Dúvidas gerais"
  | "Problemas com pedidos"
  | "Problemas com pagamentos"
  | "Atrasos nas entregas"
  | "Reclamações de serviços"
  | "Problemas com produtos"
  | "Importação"
  | "Intermediário"
  | "Problemas com vendedores"
  | "Problemas com profissionais"
  | "Acesso à conta"
  | "Cancelamentos"
  | "Reembolsos"
  | "Outros";

export type SupportTicketStatus =
  | "Novo"
  | "Em atendimento"
  | "A aguardar cliente"
  | "Encaminhado para operação"
  | "Encaminhado para administração"
  | "Resolvido"
  | "Encerrado"
  | "Aberto"
  | "Em análise";

export type SupportTicketPriority = "Baixa" | "Média" | "Alta" | "Urgente";

export interface TicketMessage {
  id: string;
  sender: "CLIENT" | "SUPPORT" | "OPERATIONS" | "ADMIN";
  senderName: string;
  text: string;
  at: string;
  isInternal?: boolean;
}

export interface TicketInternalNote {
  id: string;
  author: string;
  note: string;
  at: string;
}

export interface SupportTicket {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  category?: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedTo?: string;
  bookingId?: string;
  orderId?: string;
  quoteId?: string;
  listingId?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  response?: string;
  messages?: TicketMessage[];
  internalNotes?: TicketInternalNote[];
  forwardReason?: string;
  forwardTarget?: "OPERATIONS" | "ADMIN";
  escalatedTo?: "OPERATIONS" | "ADMIN";
  resolutionSummary?: string;
}

export type OperationalOccurrenceType =
  | "ATRASO_ENTREGA"
  | "AVARIA_TECNICA"
  | "CLIENTE_AUSENTE"
  | "MORADA_INCORRETA"
  | "DIVERGENCIA_STOCK"
  | "FALHA_PARCEIRO"
  | "RECLAMACAO_CAMPO"
  | "VISTORIA_IRREGULAR"
  | "OUTRO";

export interface OperationalOccurrence {
  id: string; // ex: "OC-101"
  type: OperationalOccurrenceType;
  title: string;
  description: string;
  relatedType: "BOOKING" | "ORDER" | "IMPORT" | "INTERMEDIARY" | "FLEET";
  relatedId: string;
  severity: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  status: "ABERTA" | "EM_RESOLUCAO" | "RESOLVIDA" | "ENCAMINHADA_ADMIN" | "ENCAMINHADA_APOIO";
  assignedStaff?: string;
  driverOrTechName?: string;
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface Coupon {
  code: string;
  discountPercent?: number;
  discountAOA?: number;
  description: string;
  active: boolean;
}

export interface BusinessContract {
  id: string;
  companyName: string;
  nif: string;
  contactName: string;
  phone: string;
  services: string[];
  monthlyValueAOA: number;
  status: "Ativo" | "Em Negociação" | "Encerrado";
  startDate: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  role: string;
  timestamp: string;
  details: string;
}

export interface StoreState {
  currentUser: UserAccount | null;
  customLogo?: string;
  currency: CurrencyCode;
  language: LanguageCode;
  whatsapp: string;
  whatsappDefault: string;
  location: string;
  subscriptionPlan: "free" | "family" | "premium" | "business";

  // Catalog & Products
  products: Product[];
  featuredProducts: string[];
  cart: CartItem[];
  productOrders: ProductOrderRecord[];

  // Dynamic Services CRUD
  customServices: Service[];
  deletedServices: string[];
  serviceOverrides: Record<
    string,
    {
      name?: string;
      description?: string;
      image?: string;
      imageFit?: "cover" | "contain";
      price?: number | null;
      unit?: string;
      available?: boolean;
      provider?: "COMPANY_OWNED" | "INDEPENDENT_PARTNER" | "BUSINESS_PARTNER";
    }
  >;
  categoryOverrides: Record<
    string,
    {
      name?: string;
      short?: string;
      image?: string;
      icon?: string;
      imageFit?: "cover" | "contain";
    }
  >;
  overrides: Record<
    string,
    {
      price?: number | null;
      available?: boolean;
      provider?: "COMPANY_OWNED" | "INDEPENDENT_PARTNER" | "BUSINESS_PARTNER";
    }
  >;
  disabledCats: Record<string, boolean>;
  featured: string[];
  heroBanners?: HeroBanner[];

  // Entities
  bookings: BookingRecord[];
  applications: ApplicationRecord[];
  registeredPartners: PartnerCompanyRecord[];
  employees: EmployeeRecord[];
  supportTickets: SupportTicket[];
  coupons: Coupon[];
  contracts: BusinessContract[];
  auditLogs: AuditLog[];

  // Partner Finances
  partnerWallet: {
    balanceAOA: number;
    pendingPayoutAOA: number;
    commissionRate: number; // e.g. 15%
    payoutHistory: Array<{ date: string; amountAOA: number; status: string; iban: string }>;
  };

  // Client Wallet
  clientWallet: {
    balanceAOA: number;
    history: Array<{
      id: string;
      date: string;
      amountAOA: number;
      type: "credit" | "debit";
      description: string;
    }>;
  };

  clientFavorites: string[];
  clientFavoriteProducts: string[];
  clientAddresses: Array<{ id: string; label: string; address: string; bairro: string; isDefault: boolean }>;
  seq: number;
  orderSeq: number;

  // PRAÇA MARKETPLACE & AFFILIATES
  pracaCategories: PracaCategory[];
  sellers: SellerRecord[];
  affiliates: AffiliateRecord[];
  affiliateLinks: AffiliateLinkRecord[];
  affiliateConversions: AffiliateConversionRecord[];
  pracaPayoutRequests: PracaPayoutRequest[];
  pracaSettings: PracaSettings;
  activeAffiliateRef?: string;
  featuredHomeProducts: string[]; // Specific IDs of Praça products displayed on Home page

  // IMPORTAÇÃO
  virtualCardRequests: VirtualCardRequest[];
  importQuotes: ImportQuoteRequest[];

  // INTERMEDIÁRIO DE BENS MATERIAIS
  intermediaryCategories: IntermediaryCategory[];
  intermediaryListings: IntermediaryListing[];
  intermediaryNegotiations: IntermediaryNegotiation[];

  // OPERAÇÃO & QUALIDADE
  operationalOccurrences: OperationalOccurrence[];
}

const KEY = "rex:v2";

export const DEMO_CLIENT_USER: UserAccount = {
  id: "usr-client-demo",
  name: "Manuel da Silva",
  email: "manuel.silva@exemplo.ao",
  phone: "923111222",
  role: "CUSTOMER",
  province: "Huambo",
  municipio: "Huambo",
  bairro: "Cidade Alta",
  address: "Rua do Comércio nº 45",
  reference: "Próximo à Rádio Huambo",
  active: true,
};

export const DEMO_OPERATIONS_USER: UserAccount = {
  id: "usr-ops-demo",
  name: "Eng. Marcos Baptista",
  email: "operacao@resolveexpress.ao",
  phone: "925444333",
  role: "OPERATIONS",
  province: "Huambo",
  municipio: "Huambo",
  bairro: "São Pedro",
  address: "Base Logística & Operações Centrais REX",
  active: true,
};

export const DEMO_SUPPORT_USER: UserAccount = {
  id: "usr-support-demo",
  name: "Teresa Cambinda",
  email: "apoio@resolveexpress.ao",
  phone: "923999888",
  role: "CUSTOMER_SUPPORT",
  province: "Huambo",
  municipio: "Huambo",
  bairro: "Cidade Alta",
  address: "Central de Apoio & Atendimento REX",
  active: true,
};

const initial: StoreState = {
  currentUser: null,
  customLogo: "",
  currency: "AOA",
  language: "PT",
  whatsapp: "",
  whatsappDefault:
    "Olá! Entrei em contacto através da Resolve Express e gostaria de solicitar informações sobre os serviços e produtos no Huambo.",
  location: "huambo",
  subscriptionPlan: "free",

  products: [...INITIAL_PRODUCTS, ...INITIAL_PRACA_PRODUCTS],
  featuredProducts: ["PROD-001", "PROD-002", "PROD-003", "PROD-004", "PRACA-PROD-01", "PRACA-PROD-02"],
  cart: [],
  productOrders: [
    {
      id: "ENC-2026-000001",
      customerName: "Manuel da Silva",
      customerPhone: "923111222",
      items: [
        {
          product: INITIAL_PRODUCTS[0], // Garrafão de Água 20L
          quantity: 2,
        },
        {
          product: INITIAL_PRODUCTS[3], // Kit Limpeza Resolve
          quantity: 1,
        },
      ],
      subtotalAOA: 16900,
      deliveryFeeAOA: 1500,
      discountAOA: 0,
      totalAOA: 18400,
      deliveryAddress: "Rua do Comércio nº 45, Bairro Cidade Alta",
      deliveryBairro: "Cidade Alta",
      paymentMethod: "Dinheiro na Entrega",
      paymentStatus: "Aguardando pagamento na entrega",
      orderStatus: "A caminho",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      estimatedDelivery: "30 a 45 minutos",
      sellerNames: ["Distribuidora Águas do Huambo", "Resolve Express Store"],
    },
  ],

  overrides: {},
  disabledCats: {},
  featured: DEFAULT_FEATURED,
  heroBanners: DEFAULT_HERO_BANNERS,
  customServices: [],
  deletedServices: [],
  serviceOverrides: {},
  categoryOverrides: {},

  bookings: [
    {
      id: "REX-2026-000001",
      serviceId: "casa--limpeza-geral",
      service: "Limpeza geral",
      category: "Serviços para Casa",
      provider: "COMPANY_OWNED",
      qty: 3,
      unit: "divisão",
      details: "Apartamento T3 no 2º andar. Limpeza geral com aspiração e cozinha.",
      photos: [],
      address: "Rua do Comércio nº 45, Bairro Cidade Alta, Huambo",
      ref: "Próximo à Rádio Huambo",
      date: new Date().toISOString().slice(0, 10),
      slot: "10:00",
      recurrence: "weekly",
      payment: "Dinheiro",
      total: 21000,
      status: "Em curso",
      paymentStatus: "Aguardando confirmação de pagamento",
      customer: "Manuel da Silva",
      phone: "923111222",
      assignedTo: "João Baptista (Equipa Resolve)",
      assignedType: "EMPLOYEE",
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      history: [
        { at: new Date(Date.now() - 3600000 * 5).toISOString(), status: "Recebido" },
        { at: new Date(Date.now() - 3600000 * 3).toISOString(), status: "Confirmado", note: "Atribuído a João Baptista" },
        { at: new Date(Date.now() - 3600000 * 1).toISOString(), status: "Em curso", note: "Funcionário no local" },
      ],
    },
    {
      id: "REX-2026-000002",
      serviceId: "lavandaria--recolha-e-entrega",
      service: "Recolha e entrega",
      category: "Lavandaria",
      provider: "COMPANY_OWNED",
      qty: 6,
      unit: "kg",
      details: "Roupa do dia a dia, camisas e lençóis.",
      photos: [],
      address: "Av. da Independência, Bairro São Pedro, Huambo",
      ref: "Perto da farmácia central",
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      slot: "14:00",
      recurrence: "none",
      payment: "Transferência bancária",
      total: 12000,
      status: "Concluído",
      paymentStatus: "Pago",
      customer: "Antónia Pereira",
      phone: "934222333",
      assignedTo: "Manuel Bento (Equipa Resolve)",
      assignedType: "EMPLOYEE",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      history: [
        { at: new Date(Date.now() - 86400000).toISOString(), status: "Recebido" },
        { at: new Date(Date.now() - 80000000).toISOString(), status: "Confirmado" },
        { at: new Date(Date.now() - 70000000).toISOString(), status: "Em curso" },
        { at: new Date(Date.now() - 60000000).toISOString(), status: "Concluído" },
      ],
      rating: 5,
      reviewComment: "Serviço excelente e pontual! Roupa veio impecavelmente dobrada.",
    },
  ],

  applications: [
    {
      id: "app-1",
      name: "Teresa dos Santos",
      phone: "928777888",
      email: "teresa.santos@exemplo.ao",
      city: "Huambo",
      skills: ["beauty", "family"],
      exp: "6 anos de experiência em tranças e penteados ao domicílio e cuidados com idosos.",
      refs: "Dona Maria da Conceição (924555111)",
      idDoc: "BI-00459201HA.pdf",
      photo: "photo-teresa.jpg",
      certs: ["Certificado_Estetica.pdf"],
      at: new Date(Date.now() - 86400000 * 2).toISOString(),
      status: "Pendente",
    },
    {
      id: "app-2",
      name: "Carlos Kaputo",
      phone: "912333444",
      email: "carlos.tech@exemplo.ao",
      city: "Huambo",
      skills: ["tech"],
      exp: "Canalizador profissional credenciado com 8 anos de experiência em redes prediais.",
      refs: "Eng. Pedro Varela (923999000)",
      idDoc: "BI-00982310HA.pdf",
      photo: "photo-carlos.jpg",
      certs: ["Alvara_Canalizacao.pdf"],
      at: new Date(Date.now() - 86400000 * 4).toISOString(),
      status: "Aprovado",
    },
  ],

  registeredPartners: [
    {
      id: "partner-comp-1",
      commercialName: "Distribuidora Águas do Huambo",
      socialReason: "Águas Puras do Planalto Central, Lda.",
      nif: "5401928392",
      manager: "Eng. Paulo Vissapa",
      phone: "923444888",
      email: "comercial@aguashuambo.ao",
      province: "Huambo",
      municipio: "Huambo",
      address: "Zona Industrial do Huambo, Lote 4B",
      activityCategory: "Água e Gás",
      description: "Fornecimento de água engarrafada e garrafões para consumo doméstico e empresarial.",
      status: "Aprovado",
      createdAt: "2026-01-10T10:00:00Z",
    },
    {
      id: "partner-comp-2",
      commercialName: "Churrasqueira Central do Planalto",
      socialReason: "Sabores de Angola Restauração Lda",
      nif: "5410928374",
      manager: "Dona Maria Augusta",
      phone: "924555999",
      email: "restaurante@saboresplanalto.ao",
      province: "Huambo",
      municipio: "Huambo",
      address: "Av. da República, Centro de Huambo",
      activityCategory: "Alimentação",
      description: "Especialista em frango no churrasco, almoços executivos e marmitas familiares.",
      status: "Aprovado",
      createdAt: "2026-01-20T14:30:00Z",
    },
    {
      id: "partner-comp-3",
      commercialName: "Supermercado Nova Esperança",
      socialReason: "Nova Esperança Comercial e Importação Lda",
      nif: "5420394851",
      manager: "Dr. Domingos Kassoma",
      phone: "928333222",
      email: "gerencia@novaesperanca.ao",
      province: "Huambo",
      municipio: "Huambo",
      address: "Bairro São Pedro, Estrada Principal",
      activityCategory: "Mercearia e Alimentação",
      description: "Produtos de mercearia, frescos e produtos alimentares de primeira necessidade.",
      status: "Pendente",
      createdAt: "2026-02-15T09:15:00Z",
    },
  ],

  employees: [
    {
      id: "emp-1",
      name: "João Baptista",
      phone: "923456789",
      email: "joao.baptista@resolveexpress.ao",
      role: "Especialista em Limpeza & Apoio",
      department: "Serviços para Casa",
      city: "Huambo",
      professionalId: "REX-EMP-014",
      admissionDate: "2025-06-01",
      active: true,
    },
    {
      id: "emp-2",
      name: "Manuel Bento",
      phone: "924567890",
      email: "manuel.bento@resolveexpress.ao",
      role: "Estafeta & Logística Rápida",
      department: "Entregas",
      city: "Huambo",
      professionalId: "REX-EMP-022",
      admissionDate: "2025-08-15",
      active: true,
    },
    {
      id: "emp-3",
      name: "Esperança Vunge",
      phone: "925678901",
      email: "esperanca.vunge@resolveexpress.ao",
      role: "Operações Lavandaria Têxtil",
      department: "Lavandaria",
      city: "Huambo",
      professionalId: "REX-EMP-031",
      admissionDate: "2025-10-01",
      active: true,
    },
  ],

  supportTickets: [
    {
      id: "TK-1081",
      customerName: "Manuel da Silva",
      customerPhone: "923111222",
      customerEmail: "manuel.silva@exemplo.ao",
      category: "Problemas com pedidos",
      subject: "Atraso na entrega de botija de gás no Bairro São Pedro",
      message: "Fiz o pedido da botija de gás há 3 horas e o estafeta ainda não chegou à morada indicada.",
      status: "Encaminhado para operação",
      priority: "Alta",
      assignedTo: "Teresa Cambinda",
      orderId: "ENC-2026-000001",
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      messages: [
        {
          id: "msg-1",
          sender: "CLIENT",
          senderName: "Manuel da Silva",
          text: "Boa tarde, fiz o pedido da botija de gás há 3 horas e o estafeta ainda não chegou à morada indicada.",
          at: new Date(Date.now() - 3600000 * 4).toISOString(),
        },
        {
          id: "msg-2",
          sender: "SUPPORT",
          senderName: "Teresa Cambinda",
          text: "Olá sr. Manuel! Lamentamos imenso o atraso. Já encaminhei a situação com prioridade para a equipa de Operação e Produção para localizarem o estafeta no terreno.",
          at: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
      ],
      internalNotes: [
        {
          id: "note-1",
          author: "Teresa Cambinda",
          note: "Cliente contactou via linha telefónica. Encaminhado para Operação para verificar estafeta.",
          at: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
      ],
      forwardReason: "Estafeta demorou mais de 2 horas. Necessário contacto operacional com a base de distribuição.",
      forwardTarget: "OPERATIONS",
    },
    {
      id: "TK-1082",
      customerName: "Dra. Luísa Cambinda",
      customerPhone: "922444555",
      customerEmail: "luisa.cambinda@clinicavidaplena.ao",
      category: "Reclamações de serviços",
      subject: "Necessidade de reforço na limpeza pós-obra da clínica",
      message: "O serviço de limpeza geral foi concluído, mas o piso do piso térreo necessita de um polimento adicional.",
      status: "Em atendimento",
      priority: "Média",
      assignedTo: "Teresa Cambinda",
      bookingId: "REX-2026-000001",
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      messages: [
        {
          id: "msg-10",
          sender: "CLIENT",
          senderName: "Dra. Luísa Cambinda",
          text: "O serviço de limpeza geral foi concluído, mas o piso do piso térreo necessita de um polimento adicional.",
          at: new Date(Date.now() - 3600000 * 12).toISOString(),
        },
      ],
      internalNotes: [
        {
          id: "note-2",
          author: "Teresa Cambinda",
          note: "A equipa técnica do Carlos Mendes foi alocada. Falta apenas vistoria de garantia da equipa de Operação.",
          at: new Date(Date.now() - 3600000 * 10).toISOString(),
        },
      ],
    },
    {
      id: "TK-1083",
      customerName: "António Chipenda",
      customerPhone: "924777888",
      customerEmail: "antonio.chipenda@gmail.com",
      category: "Problemas com produtos",
      subject: "Solicitação de troca de tamanho de calçado comprado na Praça",
      message: "Comprei os ténis desportivos tamanho 41 na loja Huambo Shoes, mas ficaram apertados. Pretendo trocar pelo 42.",
      status: "A aguardar cliente",
      priority: "Baixa",
      assignedTo: "Teresa Cambinda",
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      messages: [
        {
          id: "msg-20",
          sender: "CLIENT",
          senderName: "António Chipenda",
          text: "Comprei os ténis desportivos tamanho 41 na loja Huambo Shoes, mas ficaram apertados. Pretendo trocar pelo 42.",
          at: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
        {
          id: "msg-21",
          sender: "SUPPORT",
          senderName: "Teresa Cambinda",
          text: "Olá António! Já confirmámos com o vendedor que há stock do tamanho 42. Pode levar o artigo na embalagem original até à loja ou solicitar recolha do nosso estafeta?",
          at: new Date(Date.now() - 86400000 * 1 + 3600000).toISOString(),
        },
      ],
    },
    {
      id: "TK-1084",
      customerName: "Beatriz Nangolo",
      customerPhone: "923333444",
      customerEmail: "beatriz.nangolo@empresa.ao",
      category: "Reembolsos",
      subject: "Pedido de reembolso por cancelamento de pedido duplicado",
      message: "Houve duplo débito no meu Multicaixa Express ao pagar a compra da PRAÇA. Solicito reembolso do segundo valor.",
      status: "Encaminhado para administração",
      priority: "Urgente",
      assignedTo: "Teresa Cambinda",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      forwardReason: "Duplo débito comprovado no extrato. De acordo com as políticas de segurança, apenas a Administração Executiva pode autorizar devoluções bancárias.",
      forwardTarget: "ADMIN",
      messages: [
        {
          id: "msg-30",
          sender: "CLIENT",
          senderName: "Beatriz Nangolo",
          text: "Enviei o comprovativo em anexo. Solicito o estorno dos 15.000 Kz debitados a mais.",
          at: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: "msg-31",
          sender: "SUPPORT",
          senderName: "Teresa Cambinda",
          text: "Estimada Beatriz, o seu caso foi validado pelo apoio e remetido à Direção Financeira para emissão da transferência de retorno.",
          at: new Date(Date.now() - 86400000 * 2 + 7200000).toISOString(),
        },
      ],
    },
    {
      id: "TK-1085",
      customerName: "Mariana Costa",
      customerPhone: "928123456",
      customerEmail: "mariana.c@hotmail.com",
      category: "Importação",
      subject: "Esclarecimento sobre desalfandegamento de encomenda da China",
      message: "Gostaria de saber a estimativa de chegada ao Huambo dos componentes eletrónicos encomendados via cotação REX-IMP-001.",
      status: "Resolvido",
      priority: "Média",
      assignedTo: "Teresa Cambinda",
      quoteId: "IMP-QT-001",
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      resolvedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      response: "A carga já concluiu a inspeção em Luanda e está a caminho do Huambo com previsão de entrega amanhã às 14h.",
      resolutionSummary: "Informação de trânsito fornecida com sucesso e cliente confirmou receção das coordenadas.",
    },
  ],

  operationalOccurrences: [
    {
      id: "OC-101",
      type: "ATRASO_ENTREGA",
      title: "Mota de entregas avariada na Av. Norton de Matos",
      description: "Estafeta Manuel Bento sofreu furo de pneu durante a rota de distribuição de 3 encomendas da Praça.",
      relatedType: "FLEET",
      relatedId: "ROTA-HUAMBO-SUL",
      severity: "ALTA",
      status: "EM_RESOLUCAO",
      assignedStaff: "Eng. Marcos Baptista",
      driverOrTechName: "Manuel Bento",
      resolutionNote: "Estafeta de contingência Rui Viana despachado para transbordo das encomendas.",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: "OC-102",
      type: "CLIENTE_AUSENTE",
      title: "Cliente ausente na entrega de garrafões de água",
      description: "Estafeta aguardou 20 minutos na morada indicada no Bairro Kapango, contacto telefónico não atende.",
      relatedType: "ORDER",
      relatedId: "ENC-2026-000002",
      severity: "MEDIA",
      status: "ENCAMINHADA_APOIO",
      assignedStaff: "Eng. Marcos Baptista",
      driverOrTechName: "Carlos Mendes",
      resolutionNote: "Encaminhado para Apoio ao Cliente para contactar o cliente via WhatsApp e reagendar entrega.",
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: "OC-103",
      type: "VISTORIA_IRREGULAR",
      title: "Discrepância na vistoria técnica de viatura intermediada",
      description: "Na vistoria do Toyota Hilux 2021 (INT-CAR-01), detetada substituição de peças não declarada no anúncio.",
      relatedType: "INTERMEDIARY",
      relatedId: "INT-CAR-01",
      severity: "CRITICA",
      status: "ENCAMINHADA_ADMIN",
      assignedStaff: "Eng. Marcos Baptista",
      driverOrTechName: "Técnico Perito Nelson Paiva",
      resolutionNote: "Anúncio suspenso preventivamente e relatório pericial submetido à Administração para decisão de conformidade.",
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: "OC-104",
      type: "DIVERGENCIA_STOCK",
      title: "Stock insuficiente na loja parceira TecnoHuambo",
      description: "Loja parceira não tinha disponível a última unidade de smartphone vendida na PRAÇA.",
      relatedType: "ORDER",
      relatedId: "ENC-2026-000003",
      severity: "ALTA",
      status: "RESOLVIDA",
      assignedStaff: "Eng. Marcos Baptista",
      driverOrTechName: "Coordenador de Vendedores",
      resolutionNote: "Vendedor forneceu modelo de especificação superior pelo mesmo preço com acordo do comprador.",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      resolvedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ],

  coupons: [
    {
      code: "BEMVINDO10",
      discountPercent: 10,
      description: "10% de desconto no seu primeiro pedido ou compra",
      active: true,
    },
    {
      code: "HUAMBO2026",
      discountAOA: 2500,
      description: "2.500 Kz de desconto em pedidos acima de 15.000 Kz",
      active: true,
    },
  ],

  contracts: [
    {
      id: "CTR-B2B-01",
      companyName: "Clínica Vida Plena Huambo",
      nif: "5418029381",
      contactName: "Dra. Luísa Cambinda",
      phone: "922444555",
      services: ["Limpeza empresarial", "Higienização"],
      monthlyValueAOA: 380000,
      status: "Ativo",
      startDate: "2026-01-15",
    },
    {
      id: "CTR-B2B-02",
      companyName: "Banco Sol - Agência Central Huambo",
      nif: "5409128311",
      contactName: "Dr. Alberto Chivela",
      phone: "923888999",
      services: ["Limpeza de escritórios", "Apoio logístico"],
      monthlyValueAOA: 520000,
      status: "Ativo",
      startDate: "2026-02-01",
    },
  ],

  auditLogs: [
    {
      id: "LOG-01",
      action: "Aprovação de Parceiro Comercial",
      user: "Admin Geral",
      role: "ADMIN",
      timestamp: "2026-10-28 14:20",
      details: "Empresa 'Churrasqueira Central do Planalto' aprovada para vender na categoria Alimentação.",
    },
    {
      id: "LOG-02",
      action: "Atribuição Operacional",
      user: "Supervisor Huambo",
      role: "ADMIN",
      timestamp: "2026-10-30 08:30",
      details: "Pedido REX-2026-000001 atribuído ao funcionário João Baptista.",
    },
  ],

  partnerWallet: {
    balanceAOA: 48500,
    pendingPayoutAOA: 0,
    commissionRate: 15,
    payoutHistory: [
      {
        date: "2026-10-15",
        amountAOA: 35000,
        status: "Pago",
        iban: "AO06 0040 0000 1234 5678 9012 3",
      },
    ],
  },

  clientWallet: {
    balanceAOA: 75000,
    history: [
      {
        id: "CW-01",
        date: "2026-10-25 10:30",
        amountAOA: 100000,
        type: "credit",
        description: "Recarga de saldo via Multicaixa Express",
      },
      {
        id: "CW-02",
        date: "2026-10-27 15:45",
        amountAOA: 25000,
        type: "debit",
        description: "Pagamento de encomenda ENC-2026-000001",
      },
    ],
  },

  clientFavorites: ["casa--limpeza-geral", "lavandaria--recolha-e-entrega"],
  clientFavoriteProducts: ["PROD-001", "PROD-003"],
  clientAddresses: [
    {
      id: "addr-1",
      label: "Casa Principal",
      address: "Rua do Comércio nº 45",
      bairro: "Cidade Alta",
      isDefault: true,
    },
    {
      id: "addr-2",
      label: "Escritório",
      address: "Av. Norton de Matos, Edifício Horizonte 3º Andar",
      bairro: "Centro",
      isDefault: false,
    },
  ],

  seq: 2,
  orderSeq: 1,

  pracaCategories: INITIAL_PRACA_CATEGORIES,
  sellers: INITIAL_SELLERS,
  affiliates: INITIAL_AFFILIATES,
  affiliateLinks: INITIAL_AFFILIATE_LINKS,
  affiliateConversions: INITIAL_AFFILIATE_CONVERSIONS,
  pracaPayoutRequests: INITIAL_PRACA_PAYOUTS,
  pracaSettings: INITIAL_PRACA_SETTINGS,
  activeAffiliateRef: "",
  featuredHomeProducts: ["PRACA-PROD-01", "PRACA-PROD-02", "PRACA-PROD-03", "PRACA-PROD-04", "PRACA-PROD-05", "PRACA-PROD-06", "PRACA-PROD-07"],

  virtualCardRequests: INITIAL_VIRTUAL_CARD_REQUESTS,
  importQuotes: INITIAL_IMPORT_QUOTES,

  intermediaryCategories: INITIAL_INTERMEDIARY_CATEGORIES,
  intermediaryListings: INITIAL_INTERMEDIARY_LISTINGS,
  intermediaryNegotiations: INITIAL_INTERMEDIARY_NEGOTIATIONS,
};

const read = (): StoreState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    return {
      ...initial,
      ...parsed,
      products: parsed.products || initial.products,
      featuredProducts: parsed.featuredProducts || initial.featuredProducts,
      customServices: parsed.customServices || [],
      deletedServices: parsed.deletedServices || [],
      serviceOverrides: parsed.serviceOverrides || {},
      categoryOverrides: parsed.categoryOverrides || {},
      heroBanners: parsed.heroBanners || DEFAULT_HERO_BANNERS,
      clientWallet: parsed.clientWallet || initial.clientWallet,
      pracaCategories: parsed.pracaCategories || INITIAL_PRACA_CATEGORIES,
      sellers: parsed.sellers || INITIAL_SELLERS,
      affiliates: parsed.affiliates || INITIAL_AFFILIATES,
      affiliateLinks: parsed.affiliateLinks || INITIAL_AFFILIATE_LINKS,
      affiliateConversions: parsed.affiliateConversions || INITIAL_AFFILIATE_CONVERSIONS,
      pracaPayoutRequests: parsed.pracaPayoutRequests || INITIAL_PRACA_PAYOUTS,
      pracaSettings: parsed.pracaSettings || INITIAL_PRACA_SETTINGS,
      activeAffiliateRef: parsed.activeAffiliateRef || "",
      featuredHomeProducts: parsed.featuredHomeProducts || ["PRACA-PROD-01", "PRACA-PROD-02", "PRACA-PROD-03", "PRACA-PROD-04", "PRACA-PROD-05", "PRACA-PROD-06", "PRACA-PROD-07"],
      virtualCardRequests: parsed.virtualCardRequests || INITIAL_VIRTUAL_CARD_REQUESTS,
      importQuotes: parsed.importQuotes || INITIAL_IMPORT_QUOTES,
      intermediaryCategories: parsed.intermediaryCategories || INITIAL_INTERMEDIARY_CATEGORIES,
      intermediaryListings: parsed.intermediaryListings || INITIAL_INTERMEDIARY_LISTINGS,
      intermediaryNegotiations: parsed.intermediaryNegotiations || INITIAL_INTERMEDIARY_NEGOTIATIONS,
      operationalOccurrences: parsed.operationalOccurrences || initial.operationalOccurrences,
      supportTickets: parsed.supportTickets && parsed.supportTickets.length >= 3 ? parsed.supportTickets : initial.supportTickets,
    };
  } catch {
    return initial;
  }
};

let state: StoreState = read();
const listeners = new Set<(s: StoreState) => void>();

// List of state keys that are shared globally from admin to all users across the platform
const SHARED_KEYS = [
  "customLogo",
  "heroBanners",
  "categoryOverrides",
  "serviceOverrides",
  "customServices",
  "deletedServices",
  "products",
  "featuredProducts",
  "featured",
  "featuredHomeProducts",
  "disabledCats",
  "overrides",
  "whatsapp",
  "whatsappDefault",
  "coupons",
  "contracts",
  "registeredPartners",
  "employees",
  "applications",
  "supportTickets",
  "operationalOccurrences",
  "auditLogs",
  "partnerWallet",
  "bookings",
  "productOrders",
  "pracaCategories",
  "sellers",
  "affiliates",
  "affiliateLinks",
  "affiliateConversions",
  "pracaPayoutRequests",
  "pracaSettings",
  "virtualCardRequests",
  "importQuotes",
  "intermediaryCategories",
  "intermediaryListings",
  "intermediaryNegotiations",
] as const;

function sanitizeForStorage(obj: any, depth = 0): any {
  if (depth > 6 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForStorage(item, depth + 1));
  }
  const res: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    if (typeof val === "string" && val.startsWith("data:image/") && val.length > 8192) {
      // Exclude large data URLs from localStorage copy; memory and server retain full image
      res[k] = "";
    } else {
      res[k] = sanitizeForStorage(val, depth + 1);
    }
  }
  return res;
}

export const saveToLocalStorageSafely = (s: StoreState) => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (firstErr) {
    console.warn("Storage quota exceeded or write failed; pruning heavy local cache:", firstErr);
    try {
      const sanitized = sanitizeForStorage(s);
      localStorage.setItem(KEY, JSON.stringify(sanitized));
    } catch (secondErr) {
      console.warn("Could not save to localStorage even after sanitizing. Clearing obsolete keys...", secondErr);
      try {
        localStorage.removeItem(KEY);
        const minimal: Partial<StoreState> = {
          currentUser: s.currentUser,
          currency: s.currency,
          language: s.language,
          location: s.location,
          cart: s.cart,
          bookings: s.bookings,
          productOrders: s.productOrders,
        };
        localStorage.setItem(KEY, JSON.stringify(minimal));
      } catch (finalErr) {
        // Quiet fail - NEVER allow unhandled QuotaExceededError to break React event dispatch
        console.warn("localStorage write disabled for this session:", finalErr);
      }
    }
  }
};

let syncTimeout: any = null;
export const syncSharedStateToServer = (s: StoreState) => {
  if (typeof window === "undefined") return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const payload: Record<string, any> = {};
      SHARED_KEYS.forEach((key) => {
        if ((s as any)[key] !== undefined) {
          payload[key] = (s as any)[key];
        }
      });
      await fetch("/api/shared-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: payload }),
      });
    } catch {
      // Quiet fail if offline
    }
  }, 100);
};

// Apply remote server state updates atomically
export const applyServerStateUpdates = (serverState: any) => {
  if (!serverState || typeof serverState !== "object") return;
  let hasChanges = false;
  const nextState: StoreState = { ...state };

  SHARED_KEYS.forEach((key) => {
    if (serverState[key] !== undefined) {
      const currentVal = JSON.stringify((nextState as any)[key]);
      const serverVal = JSON.stringify(serverState[key]);
      if (currentVal !== serverVal) {
        (nextState as any)[key] = serverState[key];
        hasChanges = true;
      }
    }
  });

  if (hasChanges) {
    state = nextState;
    saveToLocalStorageSafely(state);
    listeners.forEach((fn) => fn(state));
  }
};

export const fetchSharedStateFromServer = async () => {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(`/api/shared-state?_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.state && typeof data.state === "object") {
        applyServerStateUpdates(data.state);
      }
    }

    if (isSupabaseConfigured()) {
      const sbSettings = await getSupabasePlatformSettings();
      if (sbSettings && typeof sbSettings === "object") {
        applyServerStateUpdates(sbSettings);
      }
    }
  } catch {
    // Quiet fail
  }
};

// Real-Time Server-Sent Events (SSE) setup for zero-delay cross-device sync
let sseConnection: EventSource | null = null;
const initRealtimeSSE = () => {
  if (typeof window === "undefined" || typeof EventSource === "undefined") return;
  if (sseConnection) {
    try {
      sseConnection.close();
    } catch {}
  }

  try {
    sseConnection = new EventSource("/api/shared-state/stream");
    sseConnection.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.state) {
          applyServerStateUpdates(payload.state);
        }
      } catch (err) {
        console.warn("Error parsing SSE shared state payload:", err);
      }
    };

    sseConnection.onerror = () => {
      // If SSE connection drops, retry after 5 seconds
      try {
        sseConnection?.close();
      } catch {}
      sseConnection = null;
      setTimeout(initRealtimeSSE, 5000);
    };
  } catch {
    // Fallback solely to fast polling if SSE is unsupported
  }
};

// Initial sync and aggressive multi-device sync
if (typeof window !== "undefined") {
  // 1. Initial fetch
  fetchSharedStateFromServer();

  // 2. Start real-time push channel
  initRealtimeSSE();

  // 3. Fast polling fallback (every 2.5s) to guarantee updates on phones and all networks
  setInterval(fetchSharedStateFromServer, 2500);

  // 4. Instant sync on focus / app switch (switching between apps on smartphones)
  window.addEventListener("focus", fetchSharedStateFromServer);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      fetchSharedStateFromServer();
    }
  });

  // 5. Flush pending changes before page unloads (F5 or tab close)
  window.addEventListener("beforeunload", () => {
    try {
      const payload: Record<string, any> = {};
      SHARED_KEYS.forEach((key) => {
        if ((state as any)[key] !== undefined) {
          payload[key] = (state as any)[key];
        }
      });
      navigator.sendBeacon?.(
        "/api/shared-state",
        new Blob([JSON.stringify({ state: payload })], { type: "application/json" })
      );
    } catch {}
  });

  // 6. Immediate resynchronization when coming back online after network drop
  window.addEventListener("online", () => {
    fetchSharedStateFromServer();
    initRealtimeSSE();
  });
}

const emit = () => {
  saveToLocalStorageSafely(state);
  listeners.forEach((fn) => fn(state));
  syncSharedStateToServer(state);
};

/**
 * Dedicated atomic persistence function for administrative operations.
 * Sends immediately to /api/admin-save, awaits server confirmation,
 * updates memory & local storage, and logs audit record.
 */
export async function saveAdminStateAsync(
  updater: (s: StoreState) => Partial<StoreState>,
  actionName?: string,
  details?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const nextState = { ...state, ...updater(state) };
    const payload: Record<string, any> = {};
    SHARED_KEYS.forEach((key) => {
      if ((nextState as any)[key] !== undefined) {
        payload[key] = (nextState as any)[key];
      }
    });

    // Persist to Supabase platform_settings if configured
    if (isSupabaseConfigured()) {
      try {
        await saveSupabasePlatformSettings(payload);
      } catch (sbErr) {
        console.warn("Could not sync to Supabase platform_settings:", sbErr);
      }
    }

    const res = await fetch("/api/admin-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: payload,
        action: actionName || "Alteração Administrativa",
        user: state.currentUser?.name || "Super Admin",
        role: state.currentUser?.role || "SUPER_ADMIN",
        details: details || "Atualização confirmada e guardada no servidor.",
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Servidor retornou erro HTTP ${res.status}`);
    }

    state = nextState;
    saveToLocalStorageSafely(state);
    listeners.forEach((fn) => fn(state));
    return { ok: true };
  } catch (err: any) {
    console.error("Erro na gravação administrativa:", err);
    return { ok: false, error: err.message || "Falha de rede ao gravar dados" };
  }
}

export function useStore(): [StoreState, (fn: (s: StoreState) => Partial<StoreState>) => void] {
  const [s, setS] = useState<StoreState>(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);

  const update = useCallback((fn: (s: StoreState) => Partial<StoreState>) => {
    state = { ...state, ...fn(state) };
    emit();
  }, []);

  return [s, update];
}

// Service helper
export const svcConfig = (store: StoreState, svc: Service) => {
  const o = store.overrides[svc.id] || {};
  const so = store.serviceOverrides?.[svc.id] || {};
  return {
    price: o.price !== undefined ? o.price : (so.price !== undefined ? so.price : null),
    available: o.available !== undefined ? o.available : (so.available !== undefined ? so.available : true),
    provider: o.provider || so.provider || svc.provider,
  };
};

export const getStoreServices = (store: StoreState): Service[] => {
  const deleted = new Set(store.deletedServices || []);
  const base = baseAllServices().filter((s) => !deleted.has(s.id));
  const custom = (store.customServices || []).filter((s) => !deleted.has(s.id));
  const all = [...base, ...custom];
  return all.map((s) => {
    const so = store.serviceOverrides?.[s.id];
    if (!so) return s;
    return {
      ...s,
      name: so.name || s.name,
      description: so.description || s.description,
      image: so.image || s.image,
      imageFit: so.imageFit || s.imageFit,
      unit: so.unit || s.unit,
      provider: so.provider || s.provider,
    };
  });
};

export const getStoreCategories = (store: StoreState): Category[] => {
  const svcs = getStoreServices(store);
  return CATEGORIES.map((cat) => {
    const co = store.categoryOverrides?.[cat.id];
    return {
      ...cat,
      name: co?.name || cat.name,
      short: co?.short || cat.short,
      image: co?.image || cat.image,
      icon: co?.icon || cat.icon,
      imageFit: co?.imageFit || cat.imageFit,
      services: svcs.filter((s) => s.categoryId === cat.id),
    };
  });
};

export const findStoreService = (store: StoreState, id: string): Service | undefined => {
  return getStoreServices(store).find((s) => s.id === id);
};

export const findStoreCategory = (store: StoreState, id: string): Category | undefined => {
  return getStoreCategories(store).find((c) => c.id === id);
};

export const catActive = (store: StoreState, cat?: Category) =>
  cat ? !store.disabledCats[cat.id] : false;

export const countAvailable = (store: StoreState, cat: Category) =>
  cat.services.filter((s) => svcConfig(store, s).available).length;

export const nextBookingId = (seq: number) =>
  `REX-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`;

export const nextOrderId = (seq: number) =>
  `ENC-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`;

const CURRENCY_RATES: Record<CurrencyCode, { symbol: string; rate: number }> = {
  AOA: { symbol: "Kz", rate: 1 },
  USD: { symbol: "$", rate: 0.0011 },
  EUR: { symbol: "€", rate: 0.001 },
};

export const formatCurrency = (valAOA: number, currency: CurrencyCode = "AOA"): string => {
  const c = CURRENCY_RATES[currency] || CURRENCY_RATES.AOA;
  const converted = valAOA * c.rate;
  if (currency === "AOA") {
    return new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(converted) + " Kz";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(converted);
};

export const kz = (v: number) => formatCurrency(v, "AOA");

export const waLink = (phone: string, text: string) =>
  phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
    : null;

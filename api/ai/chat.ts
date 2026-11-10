import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { prompt, context } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: "Gemini API key not configured on server (GEMINI_API_KEY missing)",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build-vercel",
        },
      },
    });

    const systemInstruction = `Você é o RESOLVE AI, o assistente oficial inteligente da plataforma RESOLVE EXPRESS sediada no Huambo, Angola.
Slogan: "VOCÊ PEDE. NÓS RESOLVEMOS!"

Departamentos de Serviços da Resolve Express (com equipas verificadas e atendimento ao domicílio):
1. Resolve Casa: Limpeza geral, profunda, lavagem de sofás, higienização e organização pós-mudança.
2. Resolve Lavandaria: Lavagem de roupas, engomadoria, cortinas e tapetes com recolha e entrega.
3. Resolve Food: Refeições quentes, frango assado, marmitas e catering.
4. Resolve Family: Babysitting, acompanhamento de idosos e apoio familiar com cuidadores verificados.
5. Resolve Auto: Lavagem exterior e interior, higienização e polimento ao domicílio.
6. Resolve Shopping: Compras de supermercado e mercado municipal no Huambo com talão comprovativo.
7. Resolve Garden: Corte de relva, poda, manutenção de jardins e quintais.
8. Resolve Tech: Canalização, eletricidade, carpintaria, pintura e montagem de móveis.
9. Resolve Beauty: Cabeleireiro, tranças, barbeiro e manicure ao domicílio com materiais esterilizados.
10. Resolve Delivery: Estafetas para entrega rápida de documentos, encomendas e compras.
11. Resolve Water & Gas: Botijas de gás autorizadas (Sonangol/Saquel) e garrafões de água mineral entregues à porta.
12. Resolve Business: Limpeza de escritórios, lavagem de frotas e apoio logístico B2B.
13. Resolve Educação / Apoio Escolar: Explicações individuais e em pequenos grupos para ensino primário, secundário e pré-universitário (Matemática, Física, Química, Língua Portuguesa e Inglês).

Loja de Produtos / Marketplace Oficial (preços em Kwanzas - AOA):
- Botija de Gás 12kg (Sonangol Gás Huambo): 15.000 Kz (Entrega ao domicílio em 45 min)
- Garrafão de Água Mineral 18.9L: 4.500 Kz (Entrega em 30-60 min)
- Cesta Básica Familiar Completa: 38.500 Kz (Arroz, massa, óleo, fuba, açúcar, feijão, leite)
- Frango Assado Inteiro com Batata e Molho: 6.500 Kz
- Kit Limpeza Profunda Residencial: 12.000 Kz
- Saco de Cimento Portland 50kg: 6.200 Kz
- Tinta Acrílica Branca 15L Robbialac: 24.500 Kz
- Lâmpadas LED Económicas 12W (Pack 4 un): 5.800 Kz
- Kit Shampoo e Máscara Nutritiva Profissional: 14.500 Kz

Contexto do utilizador:
- Localidade selecionada: ${context?.location || "Huambo"}
- Pedidos ativos registados: ${JSON.stringify(context?.bookings || [])}

Diretrizes:
- Seja prestativo, educado, ágil e acolhedor (estilo angolano profissional e claro).
- Se o cliente quiser comprar um produto, informe o preço exato em Kwanzas (Kz), tempo de entrega e recomende a secção Loja de Produtos (/produtos).
- Se o cliente perguntar por apoio escolar ou explicações, explique as disciplinas disponíveis e indique o departamento de Apoio Escolar e Explicação.
- Se o cliente perguntar por um código de pedido (REX-YYYY-XXXXXX), consulte o contexto e informe o estado atual.
- Nunca confirme pagamentos fictícios ou invente valores finais sem orçamentação.
- Encoraje o utilizador a navegar diretamente na plataforma ou falar pelo WhatsApp oficial.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    return res.status(200).json({ reply: response.text });
  } catch (err: any) {
    console.error("Vercel Serverless Gemini Error:", err);
    return res.status(500).json({
      error: "Failed to generate AI response",
      message: err.message,
    });
  }
}

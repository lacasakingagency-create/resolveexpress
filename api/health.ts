import { getSupabaseServerConfig } from "./_supabase.js";

export default function handler(_req: any, res: any) {
  const sb = getSupabaseServerConfig();
  res.status(200).json({
    status: "ok",
    app: "Resolve Express Angola",
    supabaseConfigured: sb.configured,
    hasSupabaseUrl: Boolean(sb.url),
    hasServiceRoleKey: Boolean(sb.serviceRoleKey),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
  });
}

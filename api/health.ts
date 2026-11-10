export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: "ok",
    app: "Resolve Express Angola",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
  });
}

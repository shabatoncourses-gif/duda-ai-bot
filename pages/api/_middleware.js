export function middleware(req) {
  const res = new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://www.shabaton.online",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
    },
  });

  // OPTIONS response
  if (req.method === "OPTIONS") return res;

  return res;
}

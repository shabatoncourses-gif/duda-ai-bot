export function middleware(req) {
  const origin = req.headers.get("origin");

  const allowed = [
    "https://www.shabaton.online",
    "https://shabaton.online",
    "https://morim.boutique",
    "https://www.morim.boutique"
  ];

  const headers = {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
    "Access-Control-Allow-Credentials": "true",
  };

  // תשובה לבקשת OPTIONS בלבד
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  // לכל שאר הבקשות
  const res = NextResponse.next();
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};

export function middleware(req) {
  const origin = req.headers.get("origin");

  const allowed = [
    "https://www.shabaton.online",
    "https://shabaton.online",
    "https://morim.boutique",
    "https://www.morim.boutique"
  ];

  const res = new Response(null, {
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    },
  });

  if (allowed.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  } else {
    res.headers.set("Access-Control-Allow-Origin", "https://www.shabaton.online");
  }

  if (req.method === "OPTIONS") return res;

  return res;
}

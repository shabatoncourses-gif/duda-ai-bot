export const config = { runtime: "nodejs" };

export default async function statushandler(req, res) {
  const base = "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";
  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json"
  ];

  const results = [];
  for (const f of files) {
    const url = `${base}/${f}`;
    try {
      const r = await fetch(url);
      results.push({ file: f, status: r.status });
    } catch (err) {
      results.push({ file: f, error: err.message });
    }
  }

  return res.status(200).json({
    ok: true,
    tested: new Date().toISOString(),
    results
  });
}

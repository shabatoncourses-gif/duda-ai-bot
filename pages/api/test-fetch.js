export default async function handler(req, res) {
  const url = "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data/shabaton_index_part1.json";
  try {
    const r = await fetch(url);
    const text = await r.text();
    return res.status(200).json({ ok: r.ok, status: r.status, preview: text.slice(0, 200) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

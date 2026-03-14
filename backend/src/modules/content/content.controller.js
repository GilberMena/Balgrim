import { listActiveContentBlocks } from "./content.service.js";

export async function getContentBlocks(req, res) {
  const blocks = await listActiveContentBlocks();
  res.json({ blocks });
}

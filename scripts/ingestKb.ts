// Bulk-ingest local text/markdown files into the knowledge base.
// Usage: npm run ingest:kb -- ./kb-source
// Each file becomes one kb_documents entry, chunked + embedded into kb_embeddings.
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname, basename } from "path";
import { connectToDatabase } from "../lib/mongodb";
import { ingestDocument } from "../lib/kbIngest";
import Role from "../models/Role";
import User from "../models/User";

async function main() {
  const dir = process.argv[2] ?? "./kb-source";

  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => [".md", ".txt"].includes(extname(f).toLowerCase()));
  } catch {
    console.error(`Folder tidak ditemukan: ${dir}`);
    console.error("Buat folder berisi file .md/.txt, atau jalankan: npm run ingest:kb -- <path-folder>");
    process.exit(1);
  }

  if (entries.length === 0) {
    console.log(`Tidak ada file .md/.txt di ${dir}`);
    process.exit(0);
  }

  await connectToDatabase();

  const superAdminRole = await Role.findOne({ slug: "super-admin" });
  const uploader = superAdminRole ? await User.findOne({ roleId: superAdminRole._id }) : null;
  if (!uploader) {
    console.error("Tidak ditemukan user Super Admin. Jalankan `npm run seed` terlebih dahulu.");
    process.exit(1);
  }

  for (const file of entries) {
    const path = join(dir, file);
    if (!statSync(path).isFile()) continue;

    const rawText = readFileSync(path, "utf-8");
    const title = basename(file, extname(file)).replace(/[-_]/g, " ");
    const sourceType = extname(file).toLowerCase() === ".md" ? "markdown" : "text";

    const { chunkCount } = await ingestDocument({
      title,
      category: "SOP/Ketentuan Internal",
      sourceType,
      rawText,
      uploadedBy: uploader._id.toString(),
    });

    console.log(`  - ${file}: "${title}" (${chunkCount} chunks)`);
  }

  console.log("\nSelesai.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

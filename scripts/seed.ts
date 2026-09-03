import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { connectToDatabase } from "../lib/mongodb";
import { ROLE_SEEDS } from "../lib/permissions";
import { TARIFF_RULE_SEEDS } from "../lib/tariffRuleSeeds";
import Role from "../models/Role";
import User from "../models/User";
import TariffRule from "../models/TariffRule";

async function main() {
  await connectToDatabase();

  console.log("Seeding roles...");
  const roleDocs: Record<string, InstanceType<typeof Role>> = {};
  for (const seed of ROLE_SEEDS) {
    const role = await Role.findOneAndUpdate(
      { slug: seed.slug },
      {
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        permissions: seed.permissions,
      },
      { upsert: true, new: true }
    );
    roleDocs[seed.slug] = role;
    console.log(`  - ${role.name} (${role.permissions.length} permissions)`);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME || "Super Admin";

  if (!adminEmail || !adminPassword) {
    console.log(
      "\nSEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD tidak diset - melewati pembuatan Super Admin."
    );
    console.log(
      "Jalankan lagi dengan env var tersebut untuk membuat akun Super Admin pertama."
    );
  } else {
    const existing = await User.findOne({ email: adminEmail.toLowerCase() });
    if (existing) {
      console.log(`\nUser dengan email ${adminEmail} sudah ada, dilewati.`);
    } else {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const superAdminRole = roleDocs["super-admin"];
      await User.create({
        name: adminName,
        email: adminEmail.toLowerCase(),
        passwordHash,
        roleId: superAdminRole._id,
        isActive: true,
      });
      console.log(`\nSuper Admin dibuat: ${adminEmail}`);
    }
  }

  console.log("\nSeeding tariff rules...");
  for (const seed of TARIFF_RULE_SEEDS) {
    const rule = await TariffRule.findOneAndUpdate(
      { category: seed.category, transportMode: seed.transportMode },
      { ...seed, isActive: true, effectiveDate: new Date(seed.effectiveDate) },
      { upsert: true, new: true }
    );
    console.log(`  - ${rule.category}/${rule.transportMode}: Rp${rule.maxAmount.toLocaleString("id-ID")}`);
  }

  console.log("\nSelesai.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

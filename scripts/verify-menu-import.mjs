import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const filename of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(join(root, filename), "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      process.env[key] ??= trimmed.slice(separator + 1).trim();
    }
  } catch {
    // Optional when DATABASE_URL is already available.
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const restaurantResult = await client.query(
    `select id, name from public.restaurants where id like 'r-%' order by name`
  );
  const productResult = await client.query(
    `select coalesce(vendor_id, 'grocery') as source, count(*)::int as products
     from public.products
     where id like 'menu-%'
     group by coalesce(vendor_id, 'grocery')
     order by source`
  );
  const invalidResult = await client.query(
    `select count(*)::int as invalid
     from public.products
     where id like 'menu-%'
       and (name = '' or category = '' or price <= 0 or not in_stock)`
  );

  const importedProducts = productResult.rows.reduce(
    (total, row) => total + row.products,
    0
  );
  if (restaurantResult.rows.length !== 7) {
    throw new Error(`Expected 7 imported restaurants, found ${restaurantResult.rows.length}`);
  }
  if (importedProducts !== 557) {
    throw new Error(`Expected 557 imported products, found ${importedProducts}`);
  }
  if (invalidResult.rows[0].invalid !== 0) {
    throw new Error(`Found ${invalidResult.rows[0].invalid} invalid imported products`);
  }

  console.log(
    JSON.stringify(
      {
        restaurants: restaurantResult.rows,
        productsBySource: productResult.rows,
        importedProducts,
        invalidProducts: 0,
      },
      null,
      2
    )
  );
} finally {
  await client.end();
}

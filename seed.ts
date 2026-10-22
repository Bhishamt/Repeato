/**
 * Demo data for a fresh local database.
 * Safe to re-run: it refuses to touch a database that already has users.
 */
import { randomBytes } from "node:crypto";
import { getDb } from "./lib/db";
import { hashPassword } from "./lib/password";
import { createBusiness, joinBusiness, recordPurchase, redeemReward } from "./lib/services";

try {
  process.loadEnvFile();
} catch {
  /* no .env file - defaults below are used */
}

const db = getDb();
const existing = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };

if (existing.n > 0) {
  console.log("Database already has users - seed skipped.");
  process.exit(0);
}

const adminEmail = process.env.ADMIN_EMAIL || "admin@repeato.local";
const adminPassword = process.env.ADMIN_PASSWORD || randomBytes(9).toString("base64url");
const demoPassword = process.env.DEMO_PASSWORD || "Repeato!2026";

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

function addUser(email: string, name: string, role: "owner" | "staff" | "customer" | "admin", phone: string | null = null, password = demoPassword) {
  const result = db
    .prepare("INSERT INTO users (email, name, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .run(email, name, phone, hashPassword(password), role);
  return Number(result.lastInsertRowid);
}

const adminId = addUser(adminEmail, "Repeato Admin", "admin", null, adminPassword);

// Owners and staff -----------------------------------------------------------
const priyaId = addUser("priya@bluebird.test", "Priya Nair", "owner");
const arunId = addUser("arun@bluebird.test", "Arun Shah", "staff");
const danielId = addUser("daniel@urbanbrew.test", "Daniel Rao", "owner");

// Customers ------------------------------------------------------------------
const ashaId = addUser("asha@example.test", "Asha Menon", "customer", "9000011111");
const raviId = addUser("ravi@example.test", "Ravi Iyer", "customer", "9000022222");
const meeraId = addUser("meera@example.test", "Meera Kapoor", "customer", "9000033333");

// Businesses -----------------------------------------------------------------
const bluebird = createBusiness(db, { ownerId: priyaId, name: "Bluebird Coffee", category: "Cafe", city: "Bengaluru", description: "Neighbourhood coffee bar on 12th Main. Slow coffee, warm bread, quiet mornings." });
const urban = createBusiness(db, { ownerId: danielId, name: "Urban Brew Cafe", category: "Cafe", city: "Mumbai", description: "All-day cafe in Bandra. Big tables, strong filter coffee, pastries baked at 6am." });

db.prepare("UPDATE businesses SET address = ?, phone = ?, brand_color = ? WHERE id = ?").run("12th Main Road, Indiranagar", "+91 80 4000 1200", "#17553f", bluebird.businessId);
db.prepare("UPDATE businesses SET address = ?, phone = ?, brand_color = ?, points_per_100 = ?, min_purchase_paise = ?, signup_bonus = ?, min_redeem_points = ? WHERE id = ?").run("Linking Road, Bandra West", "+91 22 4000 8800", "#8a4b1f", 10, 5_000, 50, 200, urban.businessId);

db.prepare("INSERT INTO business_members (user_id, business_id, role) VALUES (?, ?, 'staff')").run(arunId, bluebird.businessId);

// Menu -----------------------------------------------------------------------
function addCategory(businessId: number, name: string, sort: number) {
  return Number(db.prepare("INSERT INTO categories (business_id, name, sort_order) VALUES (?, ?, ?)").run(businessId, name, sort).lastInsertRowid);
}

function addProduct(businessId: number, categoryId: number, name: string, pricePaise: number, description: string, pointsOverride: number | null = null) {
  return Number(
    db
      .prepare("INSERT INTO products (business_id, category_id, name, description, price_paise, points_override) VALUES (?, ?, ?, ?, ?, ?)")
      .run(businessId, categoryId, name, description, pricePaise, pointsOverride).lastInsertRowid,
  );
}

const coffee = addCategory(bluebird.businessId, "Coffee", 1);
const bakery = addCategory(bluebird.businessId, "Bakery", 2);
addProduct(bluebird.businessId, coffee, "Filter coffee", 12_000, "House blend, 180ml");
addProduct(bluebird.businessId, coffee, "Flat white", 18_000, "Double shot, steamed milk");
addProduct(bluebird.businessId, coffee, "Cold brew", 22_000, "18-hour steep");
addProduct(bluebird.businessId, bakery, "Butter croissant", 14_000, "Laminated in-house");
addProduct(bluebird.businessId, bakery, "Banana bread", 11_000, "Toasted on request");

const drinks = addCategory(urban.businessId, "Drinks", 1);
const plates = addCategory(urban.businessId, "Plates", 2);
addProduct(urban.businessId, drinks, "Masala chai", 8_000, "Cutting chai, extra ginger");
addProduct(urban.businessId, drinks, "Iced americano", 19_000, "Double shot over ice");
addProduct(urban.businessId, plates, "Poha bowl", 13_000, "With peanuts and lime");
addProduct(urban.businessId, plates, "Grilled sandwich", 24_000, "Cheddar, tomato, chutney");

// Rewards --------------------------------------------------------------------
function addReward(businessId: number, name: string, pointsCost: number, description: string, stock: number | null = null, perCustomerLimit: number | null = null) {
  return Number(
    db
      .prepare("INSERT INTO rewards (business_id, name, points_cost, description, stock, per_customer_limit) VALUES (?, ?, ?, ?, ?, ?)")
      .run(businessId, name, pointsCost, description, stock, perCustomerLimit).lastInsertRowid,
  );
}

const freeCoffee = addReward(bluebird.businessId, "Free filter coffee", 150, "Any 180ml filter coffee, dine-in or takeaway.");
addReward(bluebird.businessId, "Coffee and croissant", 400, "A flat white with a butter croissant.");
addReward(bluebird.businessId, "Bag of house beans", 900, "250g bag, roasted this week.", 12, 1);
const chai = addReward(urban.businessId, "Free masala chai", 200, "One cutting chai, any time before 6pm.");
addReward(urban.businessId, "Breakfast plate", 650, "Poha bowl with a filter coffee.", 20);

// Memberships ----------------------------------------------------------------
for (const [userId, businessId] of [
  [ashaId, bluebird.businessId],
  [raviId, bluebird.businessId],
  [meeraId, bluebird.businessId],
  [ashaId, urban.businessId],
  [raviId, urban.businessId],
] as const) {
  joinBusiness(db, userId, businessId);
}

// Verified purchases (backdated so the analytics window has data) -------------
function sale(actorId: number, businessId: number, customerId: number, amountPaise: number, reference: string, daysAgo: number) {
  const outcome = recordPurchase(db, { actorId, businessId, customerId, amountPaise, reference, idempotencyKey: `seed:${reference}` });
  db.prepare("UPDATE purchases SET created_at = datetime('now', ?) WHERE id = ?").run(`-${daysAgo} days`, outcome.purchaseId);
  db.prepare("UPDATE ledger SET created_at = datetime('now', ?) WHERE purchase_id = ?").run(`-${daysAgo} days`, outcome.purchaseId);
  db.prepare("UPDATE notifications SET created_at = datetime('now', ?) WHERE user_id = ? AND business_id = ? AND title LIKE 'Points%'").run(`-${daysAgo} days`, customerId, businessId);
  return outcome;
}

sale(priyaId, bluebird.businessId, ashaId, 48_000, "BB-1042", 26);
sale(arunId, bluebird.businessId, ashaId, 22_000, "BB-1108", 19);
sale(priyaId, bluebird.businessId, ashaId, 61_000, "BB-1174", 12);
sale(arunId, bluebird.businessId, ashaId, 35_000, "BB-1203", 5);
sale(priyaId, bluebird.businessId, raviId, 18_000, "BB-1061", 22);
sale(arunId, bluebird.businessId, raviId, 26_000, "BB-1190", 9);
sale(priyaId, bluebird.businessId, meeraId, 51_000, "BB-1210", 3);

sale(danielId, urban.businessId, ashaId, 41_000, "UB-2201", 16);
sale(danielId, urban.businessId, ashaId, 27_000, "UB-2255", 6);
sale(danielId, urban.businessId, raviId, 64_000, "UB-2211", 18);
sale(danielId, urban.businessId, raviId, 51_000, "UB-2244", 10);
sale(danielId, urban.businessId, raviId, 35_000, "UB-2270", 4);

// One voucher already issued, one already used ------------------------------
const issued = redeemReward(db, { customerId: ashaId, businessId: bluebird.businessId, rewardId: freeCoffee });
const used = redeemReward(db, { customerId: raviId, businessId: urban.businessId, rewardId: chai });
db.prepare("UPDATE redemptions SET status = 'redeemed', redeemed_at = datetime('now', '-2 days'), redeemed_by = ? WHERE id = ?").run(danielId, used.redemptionId);
db.prepare("INSERT INTO ledger (business_id, customer_id, delta, kind, note, created_at) VALUES (?, ?, ?, 'adjust', 'Demo adjustment for ledger history', datetime('now', '-4 days'))").run(urban.businessId, raviId, 15);


db.prepare("INSERT INTO audit_log (actor_id, action, entity, entity_id, meta) VALUES (?, 'platform.seeded', 'platform', NULL, ?)").run(adminId, JSON.stringify({ businesses: 2, customers: 3 }));

const url = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
console.log(`Seeded Repeato demo data.

Admin          ${adminEmail}  /  ${adminPassword}
Owner          priya@bluebird.test  /  ${demoPassword}
Staff          arun@bluebird.test   /  ${demoPassword}
Owner          daniel@urbanbrew.test /  ${demoPassword}
Customers      asha@example.test, ravi@example.test, meera@example.test  /  ${demoPassword}

Join links     ${url}/join/bluebird-coffee
               ${url}/join/urban-brew-cafe

Bluebird Coffee: 10 points per Rs.100, Rs.100 minimum, 20 signup points, 100 points to redeem.
Urban Brew Cafe: 10 points per Rs.100, Rs.50 minimum, 50 signup points, 200 points to redeem.
One voucher is already waiting for Asha (code ${issued.token}).
Seeded at ${now()}.`);

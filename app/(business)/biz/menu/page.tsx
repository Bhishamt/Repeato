import { Archive, Plus, Power } from "lucide-react";
import { Alert, Empty, Pill, Field } from "@/components/ui";
import { consoleContext } from "@/lib/console";
import { getDb } from "@/lib/db";
import {
  archiveProduct,
  createCategory,
  createProduct,
  deleteCategory,
  toggleProduct,
  updateProduct,
} from "@/app/actions/business";
import { money } from "@/lib/format";

export const metadata = { title: "Menu" };

type Product = {
  id: number;
  name: string;
  description: string | null;
  pricePaise: number;
  pointsOverride: number | null;
  available: number;
  categoryId: number | null;
  categoryName: string | null;
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; edit?: string }>;
}) {
  const { business, role } = await consoleContext();
  const query = await searchParams;
  const db = getDb();
  const editId = Number(query.edit) || 0;

  const categories = await db
    .prepare("SELECT id, name FROM categories WHERE business_id = ? ORDER BY sort_order, name")
    .all<{ id: number; name: string }>(business.id);
  const products = await db
    .prepare(
      `SELECT p.id, p.name, p.description, p.price_paise AS pricePaise, p.points_override AS pointsOverride,
              p.available, p.category_id AS categoryId, c.name AS categoryName
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.business_id = ? AND p.archived = 0
        ORDER BY c.sort_order IS NULL, c.sort_order, c.name, p.name`,
    )
    .all<Product>(business.id);

  const back = "/biz/menu";

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-1">Catalogue</p>
        <h1 className="display text-[1.8rem] md:text-[2.2rem]">Menu &amp; products</h1>
        <p className="mt-1 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
          Products give staff a consistent price list and can carry their own points value. Archiving never deletes
          historic purchases — the price at the time is kept on every sale.
        </p>
      </div>

      {query.ok ? <Alert kind="ok">{query.ok}</Alert> : null}
      {query.error ? <Alert kind="bad">{query.error}</Alert> : null}
      {role !== "owner" ? <Alert kind="info">Only the owner can change the menu. You can still view it.</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[0.95rem] font-semibold">Active products</h2>
            <span className="text-[0.76rem] text-muted">{products.length}</span>
          </div>
          {products.length === 0 ? (
            <Empty title="No products yet">Add your espresso, filter coffee, croissant — whatever you sell most.</Empty>
          ) : (
            <ul className="divide-y divide-[#f0e9de]">
              {products.map((p) => (
                <li key={p.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[0.94rem] font-semibold">{p.name}</h3>
                        {!p.available ? <Pill kind="warn">unavailable</Pill> : null}
                        {p.pointsOverride !== null ? <Pill kind="brand">{p.pointsOverride} pts each</Pill> : null}
                      </div>
                      <p className="mt-0.5 text-[0.8rem] text-muted">
                        {p.categoryName || "Uncategorised"} · {money(p.pricePaise)}
                      </p>
                      {p.description ? <p className="mt-1 text-[0.82rem] text-ink-soft">{p.description}</p> : null}
                    </div>
                    {role === "owner" ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <form action={toggleProduct}>
                          <input type="hidden" name="businessId" value={business.id} />
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="back" value={back} />
                          <button className="btn btn-ghost btn-sm" type="submit" title={p.available ? "Mark unavailable" : "Mark available"}>
                            <Power size={12} aria-hidden /> {p.available ? "Hide" : "Show"}
                          </button>
                        </form>
                        <form action={archiveProduct}>
                          <input type="hidden" name="businessId" value={business.id} />
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="back" value={back} />
                          <button className="btn btn-ghost btn-sm text-muted" type="submit"><Archive size={12} aria-hidden /> Archive</button>
                        </form>
                      </div>
                    ) : null}
                  </div>

                  {role === "owner" ? (
                    <details className="mt-2" open={editId === p.id}>
                      <summary className="cursor-pointer list-none text-[0.76rem] font-medium text-brand">Edit</summary>
                      <form action={updateProduct} className="mt-3 grid gap-2 rounded-lg border border-line bg-paper p-3 sm:grid-cols-2">
                        <input type="hidden" name="businessId" value={business.id} />
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="back" value={back} />
                        <div>
                          <label className="label text-[0.72rem]" htmlFor={`n-${p.id}`}>Name</label>
                          <input id={`n-${p.id}`} name="name" className="input text-[0.84rem]" defaultValue={p.name} required />
                        </div>
                        <div>
                          <label className="label text-[0.72rem]" htmlFor={`pr-${p.id}`}>Price (₹)</label>
                          <input id={`pr-${p.id}`} name="price" className="input text-[0.84rem]" defaultValue={(p.pricePaise / 100).toFixed(2)} required />
                        </div>
                        <div>
                          <label className="label text-[0.72rem]" htmlFor={`c-${p.id}`}>Category</label>
                          <select id={`c-${p.id}`} name="categoryId" className="select text-[0.84rem]" defaultValue={p.categoryId ?? ""}>
                            <option value="">Uncategorised</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label text-[0.72rem]" htmlFor={`pt-${p.id}`}>Points override</label>
                          <input id={`pt-${p.id}`} name="pointsOverride" className="input text-[0.84rem]" defaultValue={p.pointsOverride ?? ""} placeholder="Blank = use loyalty rule" inputMode="numeric" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="label text-[0.72rem]" htmlFor={`d-${p.id}`}>Description</label>
                          <input id={`d-${p.id}`} name="description" className="input text-[0.84rem]" defaultValue={p.description ?? ""} />
                        </div>
                        <div className="sm:col-span-2">
                          <button className="btn btn-primary btn-sm" type="submit">Save product</button>
                        </div>
                      </form>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          {role === "owner" ? (
            <>
              <form action={createProduct} className="card card-pad">
                <h2 className="text-[0.95rem] font-semibold">Add a product</h2>
                <input type="hidden" name="businessId" value={business.id} />
                <input type="hidden" name="back" value={back} />
                <div className="mt-3">
                  <Field label="Name" name="name" required placeholder="Filter coffee" />
                  <Field label="Price (₹)" name="price" required placeholder="120" hint="Use 120 or 120.50" />
                  <div className="field">
                    <label className="label" htmlFor="categoryId">Category</label>
                    <select id="categoryId" name="categoryId" className="select" defaultValue="">
                      <option value="">Uncategorised</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <Field label="Points override (optional)" name="pointsOverride" placeholder="Blank = loyalty rule" hint="Fixed points per unit for this product." />
                  <Field label="Description (optional)" name="description" placeholder="House blend, 180 ml" />
                </div>
                <button className="btn btn-primary btn-block btn-sm" type="submit"><Plus size={13} aria-hidden /> Add product</button>
              </form>

              <div className="card card-pad">
                <form action={createCategory}>
                  <h2 className="text-[0.95rem] font-semibold">Categories</h2>
                  <input type="hidden" name="businessId" value={business.id} />
                  <input type="hidden" name="back" value={back} />
                  <div className="mt-3 flex gap-2">
                    <label htmlFor="cat" className="sr-only">New category</label>
                    <input id="cat" name="name" className="input" placeholder="Coffee" required />
                    <button className="btn btn-ghost btn-sm" type="submit">Add</button>
                  </div>
                </form>
                {categories.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {categories.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-[0.82rem]">
                        <span>{c.name}</span>
                        <form action={deleteCategory}>
                          <input type="hidden" name="businessId" value={business.id} />
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="back" value={back} />
                          <button className="text-[0.72rem] text-muted hover:text-danger" type="submit">Remove</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-[0.76rem] text-muted">No categories yet.</p>}
              </div>
            </>
          ) : (
            <div className="card card-pad">
              <h2 className="text-[0.95rem] font-semibold">Read-only</h2>
              <p className="mt-1 text-[0.82rem] text-muted">The owner manages products and prices.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

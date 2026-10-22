"use client";

import { useMemo } from "react";
import { useFormStatus } from "react-dom";
import { Receipt } from "lucide-react";
import { recordSale } from "@/app/actions/business";

type Customer = { id: number; name: string; email: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      <Receipt size={15} aria-hidden /> {pending ? "Recording…" : "Record sale"}
    </button>
  );
}

export function SaleForm({
  businessId,
  customers,
  back,
}: {
  businessId: number;
  customers: Customer[];
  back: string;
}) {
  // Generated once per form mount: a duplicate submit reuses the key and is ignored server-side.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  return (
    <form action={recordSale} className="card card-pad">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <h2 className="text-[0.98rem] font-semibold">Record a verified purchase</h2>
      <p className="mt-0.5 text-[0.8rem] text-muted">
        Points are calculated on the server from your rules. Recording the same sale twice does not award twice.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="customerId">Customer</label>
          <select id="customerId" name="customerId" className="select" required defaultValue="">
            <option value="" disabled>Choose a member…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.email}</option>
            ))}
          </select>
          {customers.length === 0 ? (
            <p className="hint mt-1.5">No members yet. Ask the customer to scan the QR code and join first.</p>
          ) : null}
        </div>
        <div className="field">
          <label className="label" htmlFor="amount">Bill amount (₹)</label>
          <input id="amount" name="amount" className="input" inputMode="decimal" placeholder="480" required />
          <p className="hint mt-1.5">Amount actually paid, after discounts. Use 480 or 480.50.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="reference">Receipt / bill number</label>
          <input id="reference" name="reference" className="input" placeholder="Optional" maxLength={60} />
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

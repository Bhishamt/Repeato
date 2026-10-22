"use client";

import { useState } from "react";
import { calculatePoints } from "@/lib/points";
import { points as fmt } from "@/lib/format";

export function PointsPreview({
  pointsPer100,
  minPurchasePaise,
  maxPointsPerTxn,
  minRedeemPoints,
  signupBonus,
}: {
  pointsPer100: number;
  minPurchasePaise: number;
  maxPointsPerTxn: number;
  minRedeemPoints: number;
  signupBonus: number;
}) {
  const [amount, setAmount] = useState("500");
  const paise = Math.round(Number(amount.replace(/[^\d.]/g, "")) * 100);
  const valid = Number.isFinite(paise) && paise > 0;
  const result = valid
    ? calculatePoints({
        amountPaise: paise,
        rules: { pointsPer100, minPurchasePaise, maxPointsPerTxn, minRedeemPoints, signupBonus },
      })
    : null;

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <label className="label" htmlFor="preview-amount">Try a bill amount (₹)</label>
      <input
        id="preview-amount"
        className="input"
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        aria-describedby="preview-result"
      />
      <p id="preview-result" aria-live="polite" className="mt-2 text-[0.86rem]">
        {!result ? (
          <span className="text-muted">Enter an amount to preview.</span>
        ) : result.eligible ? (
          <span>
            A ₹{(paise / 100).toFixed(2)} bill earns <strong className="text-brand">{fmt(result.points)} points</strong>
            {result.capped ? " (capped by your per-purchase limit)" : ""}.
          </span>
        ) : (
          <span className="text-muted">{result.reason}</span>
        )}
      </p>
      <p className="mt-1 text-[0.72rem] text-muted">Preview reflects the values in the form. Nothing is recorded.</p>
    </div>
  );
}

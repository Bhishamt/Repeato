import Link from "next/link";

export function Wordmark({ href = "/", tone = "ink" }: { href?: string; tone?: "ink" | "paper" }) {
  const color = tone === "paper" ? "#fbf7f1" : "#17130f";
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 no-underline" aria-label="Repeato home">
      <span
        className="grid h-9 w-9 place-items-center rounded-[10px]"
        style={{ background: tone === "paper" ? "#fbf7f1" : "#17553f" }}
        aria-hidden
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tone === "paper" ? "#17553f" : "#fbf7f1"} strokeWidth="2.1" strokeLinecap="round">
          <path d="M4 9a8 8 0 0 1 13.5-4.4L20 7" />
          <path d="M20 15a8 8 0 0 1-13.5 4.4L4 17" />
          <circle cx="12" cy="12" r="2.4" fill={tone === "paper" ? "#17553f" : "#fbf7f1"} stroke="none" />
        </svg>
      </span>
      <span className="display text-[1.35rem] font-semibold tracking-[-0.03em]" style={{ color }}>
        repeato<span style={{ color: "#b4653a" }}>.</span>
      </span>
    </Link>
  );
}

export function Alert({ kind = "info", children }: { kind?: "ok" | "bad" | "info"; children: React.ReactNode }) {
  const cls = kind === "ok" ? "alert-ok" : kind === "bad" ? "alert-bad" : "alert-info";
  return (
    <div className={`alert ${cls}`} role={kind === "bad" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Pill({ children, kind = "muted" }: { children: React.ReactNode; kind?: "ok" | "warn" | "bad" | "muted" | "brand" }) {
  return <span className={`pill pill-${kind}`}>{children}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub ? <span className="kpi-sub">{sub}</span> : null}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  intro,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
      <h2 className="display text-[1.75rem] leading-tight md:text-[2.35rem]">{title}</h2>
      {intro ? <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-soft">{intro}</p> : null}
    </div>
  );
}

export function Progress({ percent, label }: { percent: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label || "Progress"}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  hint,
  step,
  min,
  max,
  autoComplete,
  rows,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  hint?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  autoComplete?: string;
  rows?: number;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "url" | "search";
}) {
  const id = `f_${name}`;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {type === "textarea" ? (
        <textarea id={id} name={name} className="textarea" placeholder={placeholder} required={required} defaultValue={defaultValue} rows={rows ?? 3} />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          className="input"
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue}
          step={step}
          min={min}
          max={max}
          autoComplete={autoComplete}
          inputMode={inputMode}
        />
      )}
      {hint ? <p className="hint mt-1.5">{hint}</p> : null}
    </div>
  );
}

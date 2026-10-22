import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getBusinessBySlug, memberRole } from "@/lib/services";

function baseUrl(request: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const business = await getBusinessBySlug(db, slug);
  if (!business) return new NextResponse("Not found", { status: 404 });

  // QR images are tenant-private: only members of that business (or an admin) may download them.
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.role !== "admin" && !(await memberRole(db, user.id, business.id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const target = `${baseUrl(request)}/join/${business.slug}`;
  const png = await QRCode.toBuffer(target, {
    type: "png",
    width: 720,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#17130fff", light: "#ffffffff" },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="repeato-${business.slug}.png"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

import { Order } from "../types";

export interface OrderShareRow {
  label: string;
  value: string;
  color?: "green" | "red" | "blue";
}

const isCompletedStatus = (s?: string) => s === 'completed' || s === 'accepted' || s === 'approved';
const isFailedStatus = (s?: string) => s === 'failed' || s === 'cancelled' || s === 'rejected';

export function getArabicStatus(status?: string): { label: string; color: "green" | "red" | "blue" } {
  if (isCompletedStatus(status)) return { label: "مقبول", color: "green" };
  if (isFailedStatus(status)) return { label: "مرفوض", color: "red" };
  return { label: "قيد المراجعة", color: "blue" };
}

const STATUS_COLOR_HEX: Record<"green" | "red" | "blue", string> = {
  green: "#16a34a",
  red: "#dc2626",
  blue: "#2563eb",
};

/** يقرأ لون هوية المتجر الذي يضبطه الأدمن (appearance.primary_color) من متغيرات CSS
 *  المُطبَّقة فعلياً على الصفحة، ليُستخدم كتدرّج هيدر إيصالات الطلبات المُصدَّرة كصورة —
 *  بدل لون بنفسجي ثابت لا علاقة له بهوية المتجر. مع احتياط آمن عند تعذّر القراءة. */
export function getBrandGradient(): [string, string] {
  try {
    const styles = getComputedStyle(document.documentElement);
    const brand = styles.getPropertyValue("--brand").trim();
    const brandDark = styles.getPropertyValue("--brand-dark").trim();
    if (brand) return [brandDark || brand, brand];
  } catch {}
  return ["#7c3aed", "#4f46e5"];
}

export function buildOrderShareData(order: Order, extraRows: OrderShareRow[]): {
  title: string;
  rows: OrderShareRow[];
} {
  const status = getArabicStatus(order.status);
  const rows: OrderShareRow[] = [
    { label: "رقم الطلب", value: `#${order.id}` },
    { label: "المنتج", value: order.product_name || "-" },
    { label: "التاريخ", value: new Date(order.created_at).toLocaleString("ar-EG") },
    { label: "الإجمالي", value: `${order.total_amount} $` },
    { label: "الحالة", value: status.label, color: status.color },
    ...extraRows,
  ];
  if (order.admin_response) {
    rows.push({ label: "رد الإدارة", value: order.admin_response });
  }
  return { title: `تفاصيل الطلب #${order.id}`, rows };
}

export function buildPaymentShareData(t: {
  id: number;
  method_name: string;
  amount: number;
  status: string;
  created_at: string;
  note?: string | null;
}): { title: string; rows: OrderShareRow[] } {
  const statusMap: Record<string, { label: string; color: "green" | "red" | "blue" }> = {
    approved: { label: "مقبولة", color: "green" },
    rejected: { label: "مرفوضة", color: "red" },
  };
  const status = statusMap[t.status] || { label: "قيد التحقق", color: "blue" as const };
  const rows: OrderShareRow[] = [
    { label: "رقم العملية", value: `#TX${t.id}` },
    { label: "طريقة الشحن", value: t.method_name || "-" },
    { label: "التاريخ", value: new Date(t.created_at).toLocaleString("ar-EG") },
    { label: "المبلغ", value: `${t.amount} $` },
    { label: "الحالة", value: status.label, color: status.color },
  ];
  if (t.note) rows.push({ label: "ملاحظات", value: t.note.replace(/\[sam-api\]\s*-?\s*/gi, "") });
  return { title: `إيصال الدفعة #TX${t.id}`, rows };
}

/** يحول بطاقة الطلب لصورة PNG عبر Canvas (RTL + عربي) */
export async function orderToImageBlob(title: string, rows: OrderShareRow[], gradient?: [string, string]): Promise<Blob> {
  const width = 720;
  const paddingX = 32;
  const lineHeight = 46;
  const headerHeight = 110;
  const footerHeight = 60;
  const height = headerHeight + rows.length * lineHeight + footerHeight;

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // خلفية
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // هيدر
  const [gradStart, gradEnd] = gradient || ["#7c3aed", "#4f46e5"];
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, gradStart);
  grad.addColorStop(1, gradEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, headerHeight);

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Tahoma, Arial, sans-serif";
  ctx.fillText(title, width - paddingX, 50);
  ctx.font = "13px Tahoma, Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Saraqib Store", width - paddingX, 78);

  // صفوف البيانات
  let y = headerHeight + 34;
  rows.forEach((row, i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = "#f8f7ff";
      ctx.fillRect(0, y - 28, width, lineHeight);
    }
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillStyle = "#6b7280";
    ctx.font = "13px Tahoma, Arial, sans-serif";
    ctx.fillText(row.label, width - paddingX, y);

    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 14px Tahoma, Arial, sans-serif";
    const maxWidth = width - paddingX * 2 - 160;
    let val = row.value;
    while (ctx.measureText(val).width > maxWidth && val.length > 3) {
      val = val.slice(0, -2);
    }
    if (val !== row.value) val += "…";
    ctx.textAlign = "left";
    ctx.fillStyle = row.color ? STATUS_COLOR_HEX[row.color] : "#1f2937";
    ctx.fillText(val, paddingX, y);
    y += lineHeight;
  });

  // فوتر
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";
  ctx.font = "11px Tahoma, Arial, sans-serif";
  ctx.fillText(`تم الإنشاء بتاريخ ${new Date().toLocaleString("ar-EG")}`, width / 2, height - 22);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("canvas export failed"))), "image/png", 1);
  });
}

/** يحول بطاقة الدفعة لصورة PNG بتصميم مختلف عن الطلبات (هيدر أخضر + بطاقة مركزية للمبلغ) */
export async function paymentToImageBlob(title: string, rows: OrderShareRow[]): Promise<Blob> {
  const width = 720;
  const paddingX = 32;
  const headerHeight = 150;
  const amountCardHeight = 90;
  const rowHeight = 44;
  const footerHeight = 60;
  const height = headerHeight + amountCardHeight + rows.length * rowHeight + footerHeight + 20;

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // خلفية عامة
  ctx.fillStyle = "#f4fdf7";
  ctx.fillRect(0, 0, width, height);

  // هيدر أخضر مع نمط دائري زخرفي
  const grad = ctx.createLinearGradient(0, 0, width, headerHeight);
  grad.addColorStop(0, "#059669");
  grad.addColorStop(1, "#16a34a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, headerHeight);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(width - 40, 30, 70, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(60, headerHeight - 10, 50, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px Tahoma, Arial, sans-serif";
  ctx.fillText("Saraqib Store — إيصال دفعة", width - paddingX, 40);
  ctx.font = "bold 26px Tahoma, Arial, sans-serif";
  ctx.fillText(title, width - paddingX, 78);
  ctx.font = "12px Tahoma, Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(new Date().toLocaleString("ar-EG"), width - paddingX, 102);

  // استخراج المبلغ لعرضه كبطاقة مركزية بارزة
  const amountRow = rows.find(r => r.label === "المبلغ");
  const cardY = headerHeight + 16;
  const cardHeight = amountCardHeight - 16;
  ctx.fillStyle = "#ffffff";
  const radius = 14;
  const cardX = paddingX;
  const cardW = width - paddingX * 2;
  ctx.beginPath();
  ctx.moveTo(cardX + radius, cardY);
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardHeight, radius);
  ctx.arcTo(cardX + cardW, cardY + cardHeight, cardX, cardY + cardHeight, radius);
  ctx.arcTo(cardX, cardY + cardHeight, cardX, cardY, radius);
  ctx.arcTo(cardX, cardY, cardX + cardW, cardY, radius);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#d1fae5";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#6b7280";
  ctx.font = "12px Tahoma, Arial, sans-serif";
  ctx.fillText("المبلغ المشحون", cardX + cardW - 20, cardY + 32);
  ctx.fillStyle = "#16a34a";
  ctx.font = "bold 28px Tahoma, Arial, sans-serif";
  ctx.fillText(amountRow ? amountRow.value : "-", cardX + cardW - 20, cardY + 62);

  // صفوف التفاصيل
  let y = headerHeight + amountCardHeight + 40;
  const detailRows = rows.filter(r => r.label !== "المبلغ");
  detailRows.forEach((row, i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = "#eefdf3";
      ctx.fillRect(paddingX - 8, y - 26, width - (paddingX - 8) * 2, rowHeight);
    }
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px Tahoma, Arial, sans-serif";
    ctx.fillText(row.label, width - paddingX, y);

    ctx.font = "bold 13px Tahoma, Arial, sans-serif";
    const maxWidth = width - paddingX * 2 - 160;
    let val = row.value;
    while (ctx.measureText(val).width > maxWidth && val.length > 3) {
      val = val.slice(0, -2);
    }
    if (val !== row.value) val += "…";
    ctx.textAlign = "left";
    ctx.fillStyle = row.color ? STATUS_COLOR_HEX[row.color] : "#1f2937";
    ctx.fillText(val, paddingX, y);
    y += rowHeight;
  });

  // فوتر
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";
  ctx.font = "11px Tahoma, Arial, sans-serif";
  ctx.fillText("إيصال إلكتروني — لا يحتاج لتوقيع أو ختم", width / 2, height - 22);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("canvas export failed"))), "image/png", 1);
  });
}

/** يحول بيانات الطلب لملف CSV بترميز UTF-8 BOM (يدعم العربية في Excel) */
export function orderToCsvBlob(title: string, rows: OrderShareRow[]): Blob {
  const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [`${escape("البيان")},${escape("القيمة")}`];
  lines.push(`${escape(title)},`);
  rows.forEach(r => lines.push(`${escape(r.label)},${escape(r.value)}`));
  const csv = "\uFEFF" + lines.join("\r\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}

/** يبني PDF بسيط عبر طباعة HTML من نافذة مخفية (يدعم RTL والعربية بالكامل) */
export async function orderToPdfBlob(title: string, rows: OrderShareRow[], theme: "purple" | "green" = "purple"): Promise<Blob> {
  const headerBg = theme === "green"
    ? "linear-gradient(90deg,#059669,#16a34a)"
    : "linear-gradient(90deg,#4f46e5,#7c3aed)";
  const html = `
  <html dir="rtl" lang="ar">
  <head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color:#1f2937; }
    h1 { font-size: 20px; background: ${headerBg}; color:#fff; padding:16px; border-radius:10px; }
    table { width:100%; border-collapse: collapse; margin-top: 16px; }
    td { padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 13px; }
    td:first-child { color:#6b7280; width: 35%; }
    td:last-child { font-weight: bold; }
    tr:nth-child(even) { background: #f8f7ff; }
    footer { margin-top:24px; font-size:11px; color:#9ca3af; text-align:center; }
  </style>
  </head>
  <body>
    <h1>${title}</h1>
    <table>
      ${rows.map(r => `<tr><td>${r.label}</td><td${r.color ? ` style="color:${STATUS_COLOR_HEX[r.color]}"` : ""}>${r.value}</td></tr>`).join("")}
    </table>
    <footer>تم الإنشاء بتاريخ ${new Date().toLocaleString("ar-EG")} — Saraqib Store</footer>
  </body>
  </html>`;

  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "-9999px";
    iframe.style.width = "800px";
    iframe.style.height = "1000px";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }
    }, 300);
    // يعتمد على مربع حوار الطباعة (حفظ كـ PDF) لضمان دعم كامل للعربية RTL
    resolve(new Blob([html], { type: "text/html;charset=utf-8;" }));
  });
}

/** يطبع إيصال الطلب مباشرةً كفاتورة (عبر مربع حوار طباعة المتصفح) بدل تنزيله — نفس أسلوب
 *  orderToPdfBlob لكن بتنسيق فاتورة رسمية (رقم/تاريخ/جدول/إجمالي) وبتدرّج لوني مُمرَّر بدل
 *  خيار ثابت، ليطابق لون حالة الطلب (أخضر لنجاح، كهرماني لمراجعة، أحمر لرفض). */
export function printReceipt(title: string, rows: OrderShareRow[], gradient: [string, string] = ["#16a34a", "#059669"]): void {
  const totalRow = rows.find(r => r.label === "المبلغ المدفوع" || r.label === "المبلغ");
  const detailRows = rows.filter(r => r !== totalRow);
  const html = `
  <html dir="rtl" lang="ar">
  <head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: Tahoma, Arial, sans-serif; padding: 36px; color:#1f2937; }
    .inv-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 3px solid; border-image: linear-gradient(90deg, ${gradient[0]}, ${gradient[1]}) 1; padding-bottom:18px; margin-bottom:22px; }
    .inv-header h1 { font-size: 20px; margin:0 0 4px; }
    .inv-header .sub { font-size:12px; color:#9ca3af; }
    .inv-header .store { font-size:13px; font-weight:bold; background: linear-gradient(90deg, ${gradient[0]}, ${gradient[1]}); -webkit-background-clip:text; background-clip:text; color:transparent; }
    table { width:100%; border-collapse: collapse; }
    td { padding: 11px 6px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    td:first-child { color:#6b7280; width: 40%; }
    td:last-child { font-weight: bold; }
    .total-row td { font-size:16px; padding-top:18px; border-top:2px solid #e5e7eb; border-bottom:none; }
    .total-row td:last-child { color:${gradient[0]}; }
    footer { margin-top:32px; font-size:11px; color:#9ca3af; text-align:center; }
    @media print { body { padding:0 24px; } }
  </style>
  </head>
  <body>
    <div class="inv-header">
      <div><h1>${title}</h1><div class="sub">${new Date().toLocaleString("ar-EG")}</div></div>
      <div class="store">Saraqib Store</div>
    </div>
    <table>
      ${detailRows.map(r => `<tr><td>${r.label}</td><td${r.color ? ` style="color:${STATUS_COLOR_HEX[r.color]}"` : ""}>${r.value}</td></tr>`).join("")}
      ${totalRow ? `<tr class="total-row"><td>${totalRow.label}</td><td>${totalRow.value}</td></tr>` : ""}
    </table>
    <footer>فاتورة إلكترونية لا تحتاج لتوقيع أو ختم — Saraqib Store</footer>
  </body>
  </html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "-9999px";
  iframe.style.width = "800px";
  iframe.style.height = "1000px";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }
  }, 300);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function shareFile(blob: Blob, filename: string, title: string, text: string): Promise<boolean> {
  try {
    const file = new File([blob], filename, { type: blob.type });
    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title, text });
      return true;
    }
  } catch {
    // تجاهل الإلغاء أو الفشل والعودة للتنزيل
  }
  return false;
}

export function shareViaWhatsApp(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function buildShareText(title: string, rows: OrderShareRow[]): string {
  const lines = [title, ""];
  rows.forEach(r => lines.push(`${r.label}: ${r.value}`));
  lines.push("", "Saraqib Store");
  return lines.join("\n");
}

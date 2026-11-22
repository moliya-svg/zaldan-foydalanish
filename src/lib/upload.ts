"use client";
import { createClient } from "./supabase/client";
import { FILE_LIMIT_BYTES } from "./validation";

async function head(file: Blob, n: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, n).arrayBuffer());
}

/** Файл ичидаги «сеҳрли байтлар» бўйича ҳақиқий турини текшириш */
export async function sniff(file: Blob): Promise<"pdf" | "jpeg" | "png" | "webp" | null> {
  const b = await head(file, 12);
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "webp";
  return null;
}

/** Расмни JPEG'га айлантириш ва сиқиш (энг узун томони 2000px, сифат 0.82) */
export async function toCompressedJpeg(file: File, maxSide = 2000, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("JPEG"))), "image/jpeg", quality));
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  // Сиқилган файл каттароқ бўлиб қолса ва асл JPEG бўлса — аслини қолдирамиз
  if (blob.size >= file.size && file.type === "image/jpeg") return file;
  return new File([blob], name, { type: "image/jpeg" });
}

export async function prepareFile(file: File, kind: "pdf" | "jpeg"): Promise<File> {
  const real = await sniff(file);
  if (kind === "pdf") {
    if (real !== "pdf") throw new Error(`«${file.name}» PDF файл эмас`);
    if (file.size > FILE_LIMIT_BYTES) throw new Error(`«${file.name}» 10 MB дан катта`);
    return file;
  }
  if (!real || real === "pdf") throw new Error(`«${file.name}» расм эмас (JPEG, PNG ёки WebP керак)`);
  const jpeg = await toCompressedJpeg(file);
  if (jpeg.size > FILE_LIMIT_BYTES) throw new Error(`«${file.name}» сиқилгандан кейин ҳам 10 MB дан катта`);
  return jpeg;
}

export async function uploadBookingFiles(bookingId: string, files: { file: File; kind: "pdf" | "jpeg" }[], userId: string) {
  const supabase = createClient();
  const errors: string[] = [];
  for (const { file, kind } of files) {
    const path = `bookings/${bookingId}/${crypto.randomUUID()}.${kind === "pdf" ? "pdf" : "jpg"}`;
    const { error: upErr } = await supabase.storage.from("booking-files").upload(path, file, {
      contentType: kind === "pdf" ? "application/pdf" : "image/jpeg",
      upsert: false,
    });
    if (upErr) { errors.push(`${file.name}: ${upErr.message}`); continue; }
    const { error: dbErr } = await supabase.from("booking_files").insert({
      booking_id: bookingId, kind, path, original_name: file.name, size_bytes: file.size, uploaded_by: userId,
    });
    if (dbErr) errors.push(`${file.name}: ${dbErr.message}`);
  }
  return errors;
}

export { fmtSize } from "./format";

import { z } from "zod";
import { normalizePhone } from "./phone";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Санани танланг");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Соатни танланг");

export const bookingSchema = z
  .object({
    room_id: z.string().uuid("Зал ёки хонани танланг"),
    start_date: date,
    start_time: time,
    end_date: date,
    end_time: time,
    time_mode: z.enum(["daily", "continuous"]),
    skip_weekends: z.boolean(),
    organization: z.string().trim().min(2, "Ташкилот номини ёзинг").max(200),
    event_title: z.string().trim().min(2, "Тадбир номини ёзинг").max(200),
    event_topic: z
      .string()
      .trim()
      .max(300, "Мавзу 300 белгидан ошмасин")
      .optional()
      .transform((v) => (v ? v : null)),
    contact_name: z
      .string()
      .trim()
      .max(120, "Ф.И.Ш. 120 белгидан ошмасин")
      .optional()
      .transform((v) => (v ? v : null)),
    contact_phone: z
      .string()
      .optional()
      .transform((v, ctx) => {
        // Бўш ёки фақат «+998» — киритилмаган ҳисобланади
        if (!v || v.replace(/\D/g, "").replace(/^998/, "") === "") return null;
        const p = normalizePhone(v);
        if (!p) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Телефон рақам нотўғри: +998 (XX) XXX-XX-XX" });
          return z.NEVER;
        }
        return p;
      }),
    note: z.string().trim().max(1000, "Изоҳ 1000 белгидан ошмасин").optional().default(""),
    attendees: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v === "" || v == null ? undefined : Number(v)))
      .pipe(z.number({ invalid_type_error: "Сон киритинг" }).int().positive("Мусбат сон киритинг").optional()),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("").transform(() => undefined)),
  })
  .superRefine((v, ctx) => {
    const start = `${v.start_date}T${v.start_time}`;
    const end = `${v.end_date}T${v.end_time}`;
    if (v.end_date < v.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "Тугаш санаси бошланишдан олдин бўлмасин" });
    } else if (v.time_mode === "continuous" && end <= start) {
      ctx.addIssue({ code: "custom", path: ["end_time"], message: "Тугаш вақти бошланишдан кейин бўлсин" });
    } else if (v.time_mode === "daily" && v.end_time <= v.start_time) {
      ctx.addIssue({ code: "custom", path: ["end_time"], message: "Ҳар куни режимида тугаш соати бошланишдан кейин бўлсин" });
    }
  });

export type BookingInput = z.input<typeof bookingSchema>;
export type BookingParsed = z.output<typeof bookingSchema>;

export const FILE_LIMIT_BYTES = 10 * 1024 * 1024;

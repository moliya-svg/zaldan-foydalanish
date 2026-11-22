import { describe, it, expect } from "vitest";
import { bookingSchema } from "@/lib/validation";

const base = {
  room_id: "7d1f6a52-3a54-4c8e-9a51-1f0b8a2e4c11",
  start_date: "2026-11-24", start_time: "09:00", end_date: "2026-11-24", end_time: "13:00",
  time_mode: "daily", skip_weekends: false, organization: "Вазирлик", event_title: "Семинар",
};

describe("bookingSchema: Ф.И.Ш. ва телефон ихтиёрий", () => {
  it("иккаласи бўш бўлса ҳам ўтади ва null қайтаради", () => {
    const r = bookingSchema.safeParse({ ...base, contact_name: "", contact_phone: "" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.contact_name).toBeNull(); expect(r.data.contact_phone).toBeNull(); }
  });
  it("фақат «+998» маскаси бўш ҳисобланади", () => {
    const r = bookingSchema.safeParse({ ...base, contact_phone: "+998" });
    expect(r.success && r.data.contact_phone).toBeNull();
  });
  it("тўлиқ рақам нормаллашади", () => {
    const r = bookingSchema.safeParse({ ...base, contact_name: " Али Валиев ", contact_phone: "+998 (90) 123-45-67" });
    expect(r.success && r.data).toMatchObject({ contact_name: "Али Валиев", contact_phone: "+998901234567" });
  });
  it("чала рақам рад этилади", () => {
    const r = bookingSchema.safeParse({ ...base, contact_phone: "+998 (90) 12" });
    expect(r.success).toBe(false);
  });
});

describe("bookingSchema: тадбир мавзуси ихтиёрий", () => {
  it("бўш ёки берилмаса null бўлади", () => {
    const a = bookingSchema.safeParse({ ...base, event_topic: "   " });
    const b = bookingSchema.safeParse(base);
    expect(a.success && a.data.event_topic).toBeNull();
    expect(b.success && b.data.event_topic).toBeNull();
  });
  it("бўшлиқлари кесилади, 300 белгидан ошса рад этилади", () => {
    const ok = bookingSchema.safeParse({ ...base, event_topic: "  Бюджет ижроси  " });
    expect(ok.success && ok.data.event_topic).toBe("Бюджет ижроси");
    expect(bookingSchema.safeParse({ ...base, event_topic: "а".repeat(301) }).success).toBe(false);
  });
});

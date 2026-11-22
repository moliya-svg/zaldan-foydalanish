import { describe, expect, it } from "vitest";
import { occupiedDays, toSegments, slotsOnDay, monthRange, tkDate, tkTime, totalHours, weekday, daysInMonth } from "@/lib/dates";
import { normalizePhone, maskPhoneInput, formatPhone } from "@/lib/phone";
import { bookingColor, PALETTE } from "@/lib/colors";
import { bookingSchema } from "@/lib/validation";

const s = (a: string, b: string): [string, string] => [a, b];

describe("Тошкент вақти", () => {
  it("UTC ни +05:00 га ўгиради", () => {
    expect(tkDate("2026-11-24T20:30:00Z")).toBe("2026-11-25");
    expect(tkTime("2026-11-24T04:00:00Z")).toBe("09:00");
  });
  it("ой оралиғи", () => {
    expect(monthRange(2026, 12)).toEqual({ from: "2026-12-01T00:00:00+05:00", to: "2027-01-01T00:00:00+05:00" });
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(weekday(2026, 11, 23)).toBe(0); // душанба
  });
});

describe("Полосалар", () => {
  const daily = [
    s("2026-11-24T09:00:00+05:00", "2026-11-24T13:00:00+05:00"),
    s("2026-11-25T09:00:00+05:00", "2026-11-25T13:00:00+05:00"),
    s("2026-11-27T09:00:00+05:00", "2026-11-27T13:00:00+05:00"),
  ];
  it("кунлар ва сегментлар", () => {
    const days = occupiedDays(daily, 2026, 11);
    expect([...days].sort()).toEqual([24, 25, 27]);
    expect(toSegments(days)).toEqual([{ start: 24, end: 25 }, { start: 27, end: 27 }]);
  });
  it("ой чегарасидан ўтадиган узлуксиз брон", () => {
    const c = [s("2026-11-29T10:00:00+05:00", "2026-12-02T18:00:00+05:00")];
    expect([...occupiedDays(c, 2026, 11)]).toEqual([29, 30]);
    expect([...occupiedDays(c, 2026, 12)]).toEqual([1, 2]);
    expect(slotsOnDay(c, 2026, 11, 30)).toEqual(["00:00–24:00"]);
    expect(slotsOnDay(c, 2026, 12, 2)).toEqual(["00:00–18:00"]);
  });
  it("ярим тунда тугаса кейинги кун эгалланмайди", () => {
    const c = [s("2026-11-10T18:00:00+05:00", "2026-11-11T00:00:00+05:00")];
    expect([...occupiedDays(c, 2026, 11)]).toEqual([10]);
    expect(slotsOnDay(c, 2026, 11, 10)).toEqual(["18:00–24:00"]);
  });
  it("жами соат", () => expect(totalHours(daily)).toBe(12));
});

describe("Телефон", () => {
  it("нормаллаштириш", () => {
    expect(normalizePhone("+998 (90) 123-45-67")).toBe("+998901234567");
    expect(normalizePhone("901234567")).toBe("+998901234567");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("маска", () => {
    expect(maskPhoneInput("90123")).toBe("+998 (90) 123");
    expect(maskPhoneInput("998901234567")).toBe("+998 (90) 123-45-67");
    expect(formatPhone("+998901234567")).toBe("+998 (90) 123-45-67");
  });
});

describe("Ранг", () => {
  it("бир ташкилотга доим бир ранг", () => {
    expect(bookingColor({ color: null, organization: "Молия" })).toBe(bookingColor({ color: null, organization: " молия " }));
    expect(PALETTE).toContain(bookingColor({ color: null, organization: "X" }));
    expect(bookingColor({ color: "#123456", organization: "X" })).toBe("#123456");
  });
});

describe("Форма валидацияси", () => {
  const base = {
    room_id: "4b3c1c1e-0c2d-4f5e-9a6b-7c8d9e0f1a2b",
    start_date: "2026-11-24", start_time: "09:00", end_date: "2026-11-26", end_time: "13:00",
    time_mode: "daily" as const, skip_weekends: false,
    organization: "Молия академияси", event_title: "Семинар", contact_name: "Каримов Акмал",
    contact_phone: "+998 (90) 123-45-67", note: "", attendees: "", color: "",
  };
  it("тўғри маълумот ўтади", () => {
    const r = bookingSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.contact_phone).toBe("+998901234567");
  });
  it("тугаш санаси олдин бўлса рад этади", () => {
    expect(bookingSchema.safeParse({ ...base, end_date: "2026-11-20" }).success).toBe(false);
  });
  it("ҳар куни режимида соатлар тескари бўлса рад этади", () => {
    expect(bookingSchema.safeParse({ ...base, start_time: "14:00", end_time: "10:00" }).success).toBe(false);
  });
  it("узлуксиз режимда кўп кунлик кечки тугаш мумкин", () => {
    expect(bookingSchema.safeParse({ ...base, time_mode: "continuous", start_time: "14:00", end_time: "10:00" }).success).toBe(true);
  });
});

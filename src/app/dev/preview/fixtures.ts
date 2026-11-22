import type { Booking, Room, Viewer } from "@/lib/types";

export const fixtureViewer: Viewer = { id: "u1", email: "ilxomovb2023@gmail.com", role: "super_admin", isAdmin: true, isSuperAdmin: true };

const names: [string, Room["kind"], number, string | null][] = [
  ["Катта мажлислар зали", "hall", 154, "Ўзгарган ҳолда: 80–90"], ["Кичик мажлислар зали", "hall", 28, "Ўзгарган ҳолда: 40"],
  ["105-хона", "classroom", 24, null], ["107-хона", "classroom", 20, null], ["108-хона", "computer", 16, null], ["109-хона", "classroom", 20, null],
  ["110-хона", "classroom", 24, null], ["111-хона", "computer", 16, null], ["113-хона", "classroom", 16, null], ["204-хона", "classroom", 20, null],
  ["205-хона", "computer", 16, null], ["206-хона", "classroom", 20, null], ["207-хона", "classroom", 30, null], ["208-хона", "computer", 16, null],
  ["210-хона", "classroom", 24, null], ["305-хона", "classroom", 24, null], ["307-хона", "classroom", 20, null], ["308-хона", "computer", 20, null],
  ["309-хона", "classroom", 20, null], ["310-хона", "classroom", 30, null], ["311-хона", "computer", 20, null], ["313-хона", "classroom", 24, null],
];

export function fixtureRooms(): Room[] {
  return names.map(([name, kind, capacity, alt], i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, name, kind, capacity, capacity_alt: alt,
    floor: kind === "hall" ? null : Number(name[0]), amenities: [], photo_url: null, is_active: true, sort_order: i,
  }));
}

function daily(from: number, to: number, h1: string, h2: string, month = 11, skipWeekends = false): [string, string][] {
  const out: [string, string][] = [];
  for (let d = from; d <= to; d++) {
    const dow = new Date(Date.UTC(2026, month - 1, d)).getUTCDay();
    if (skipWeekends && (dow === 0 || dow === 6)) continue;
    const ds = `2026-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    out.push([`${ds}T${h1}:00+05:00`, `${ds}T${h2}:00+05:00`]);
  }
  return out;
}

const TOPICS = ["Давлат бюджети ижроси ҳисоботини тузиш тартиби", null, "Ғазначилик тизимида электрон тўловлар", "Бухгалтерия ҳисоби модули"];

export function fixtureBookings(rooms: Room[]): Booking[] {
  const rows: [number, string, string, string, string, [string, string][], "daily" | "continuous"][] = [
    [0, "Молия академияси", "Бюджет ҳисоботи бўйича семинар", "Каримов Акмал Тўлқинович", "+998901234567", daily(3, 5, "09:00", "13:00"), "daily"],
    [0, "Иқтисодиёт ва молия вазирлиги", "Ҳайъат мажлиси", "Тошматов Бахтиёр", "+998935556677", [["2026-11-12T14:00:00+05:00", "2026-11-12T18:00:00+05:00"]], "continuous"],
    [1, "Ғазначилик қўмитаси", "Тренинг: электрон ғазна", "Юсупова Дилноза", "+998977001122", daily(9, 20, "10:00", "12:30", 11, true), "daily"],
    [4, "Солиқ қўмитаси", "1С дастури бўйича ўқув курси", "Рахимов Жасур", "+998998887766", daily(16, 27, "14:00", "17:00", 11, true), "daily"],
    [12, "Марказий банк", "Халқаро конференцияга тайёргарлик", "Абдуллаев Шерзод", "+998901112233", [["2026-11-23T09:00:00+05:00", "2026-11-25T18:00:00+05:00"]], "continuous"],
    [0, "Ўқув маркази", "Малака ошириш курси (очилиш)", "Назарова Мадина", "+998946665544", [["2026-11-27T09:00:00+05:00", "2026-12-03T18:00:00+05:00"]], "continuous"],
    [2, "Статистика агентлиги", "Давра суҳбати", "Ҳамидов Отабек", "+998912223344", daily(24, 24, "15:00", "17:00"), "daily"],
    [9, "Ҳисоб палатаси", "Аудит стандартлари", "Собирова Нилуфар", "+998903334455", [["2026-10-28T09:00:00+05:00", "2026-11-04T17:00:00+05:00"]], "continuous"],
  ];
  return rows.map(([ri, org, title, name, phone, slots, mode], i) => ({
    id: `b${i}`, seq_no: i + 1, room_id: rooms[ri].id, room_name: rooms[ri].name,
    starts_at: slots[0][0], ends_at: slots[slots.length - 1][1], time_mode: mode, skip_weekends: false,
    organization: org, event_title: title, event_topic: TOPICS[i] ?? null, contact_name: name, contact_phone: phone, note: i === 0 ? "Проектор ва 2 та микрофон керак" : null,
    attendees: null, color: null, status: "confirmed", cancel_reason: null, created_by: "u1", created_by_email: "ilxomovb2023@gmail.com", created_by_name: "Илхомов Б.",
    created_at: "2026-11-01T10:00:00+05:00", updated_at: "2026-11-01T10:00:00+05:00", slots, file_count: 0,
  }));
}

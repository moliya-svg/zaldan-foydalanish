export type Role = "super_admin" | "admin" | "viewer";
export type TimeMode = "continuous" | "daily";

export interface Room {
  id: string;
  name: string;
  kind: "hall" | "classroom" | "computer";
  floor: number | null;
  capacity: number;
  capacity_alt: string | null;
  amenities: string[];
  photo_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Booking {
  id: string;
  seq_no: number;
  room_id: string;
  room_name: string;
  starts_at: string;
  ends_at: string;
  time_mode: TimeMode;
  skip_weekends: boolean;
  organization: string;
  event_title: string;
  event_topic: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  note: string | null;
  attendees: number | null;
  color: string | null;
  status: "confirmed" | "cancelled";
  cancel_reason: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  /** [start, end) ISO pairs */
  slots: [string, string][];
  file_count: number;
}

export interface Viewer {
  id: string;
  email: string;
  role: Role;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export const ROOM_KIND_LABEL: Record<Room["kind"], string> = {
  hall: "Мажлислар зали",
  classroom: "Ўқув хонаси",
  computer: "Компьютер синф хонаси",
};

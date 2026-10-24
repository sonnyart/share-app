export type PhotoMemory = {
  id: string;
  image_url: string;
  file_path: string;
  date: string;
  location: string;
  group_id?: string | null;
};

export type PhotoGroup = {
  key: string;
  photos: PhotoMemory[];
};

export type CalendarEventType = "schedule" | "anniversary";

export type CalendarEvent = {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string; // YYYY-MM-DD
  created_at?: string;
};

export type WishItem = {
  id: string;
  text: string;
  done: boolean;
  created_at?: string;
};

import { supabase } from "@/lib/supabase";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";

export type EventInput = {
  title: string;
  type: CalendarEventType;
  date: string;
};

export async function loadEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CalendarEvent[];
}

export async function addEvent(input: EventInput): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from("events")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CalendarEvent;
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { error } = await supabase.from("events").update(input).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

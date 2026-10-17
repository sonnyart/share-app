import { supabase } from "@/lib/supabase";
import type { WishItem } from "@/lib/types";

export async function loadWishes(): Promise<WishItem[]> {
  const { data, error } = await supabase
    .from("wishes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as WishItem[];
}

export async function addWish(text: string): Promise<WishItem> {
  const { data, error } = await supabase
    .from("wishes")
    .insert({ text, done: false })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as WishItem;
}

export async function updateWishText(id: string, text: string): Promise<void> {
  const { error } = await supabase.from("wishes").update({ text }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleWishDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from("wishes").update({ done }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteWish(id: string): Promise<void> {
  const { error } = await supabase.from("wishes").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

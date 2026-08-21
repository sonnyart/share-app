import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

console.log("Supabase URL:", supabaseUrl);
console.log(
  "Supabase Key:",
  supabaseKey ? "KEY EXISTS" : "KEY MISSING"
);

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
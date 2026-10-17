import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase 환경변수가 없습니다. .env 파일에 EXPO_PUBLIC_SUPABASE_URL 과 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 설정해주세요."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

import { Pacifico_400Regular, useFonts } from "@expo-google-fonts/pacifico";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { palette } from "@/constants/theme";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Pacifico_400Regular });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="photos" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="wish" />
        <Stack.Screen name="photo/[id]" />
      </Stack>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

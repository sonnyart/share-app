import AsyncStorage from "@react-native-async-storage/async-storage";

const START_DATE_KEY = "shareapp.startDate";

export async function getStartDate(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(START_DATE_KEY);
  } catch {
    return null;
  }
}

export async function setStartDate(date: string): Promise<void> {
  await AsyncStorage.setItem(START_DATE_KEY, date);
}

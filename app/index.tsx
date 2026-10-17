import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily, palette } from "@/constants/theme";
import { daysSince, formatKoreanDate, isValidDateStr, todayStr } from "@/lib/dates";
import { addPhoto, loadPhotos } from "@/lib/photos";
import { getStartDate, setStartDate } from "@/lib/storage";
import type { PhotoMemory } from "@/lib/types";

const MAX_WIDTH = 935;
const MODAL_MAX_WIDTH = 400;
const GAP = 1;

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [startDate, setStartDateState] = useState<string | null>(null);
  const [loadingDate, setLoadingDate] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [photos, setPhotos] = useState<PhotoMemory[]>([]);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const [saved, photoList] = await Promise.all([
          getStartDate(),
          loadPhotos().catch(() => [] as PhotoMemory[]),
        ]);
        if (active) {
          setStartDateState(saved);
          setPhotos(photoList);
          setLoadingDate(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  async function handleAddPhoto() {
    if (adding) {
      return;
    }
    setAdding(true);
    try {
      const added = await addPhoto();
      if (added) {
        setPhotos(await loadPhotos());
      }
    } catch (error) {
      Alert.alert(
        "사진 추가 오류",
        error instanceof Error ? error.message : "알 수 없는 오류"
      );
    } finally {
      setAdding(false);
    }
  }

  async function refreshAll() {
    const [saved, photoList] = await Promise.all([
      getStartDate(),
      loadPhotos().catch(() => [] as PhotoMemory[]),
    ]);
    setStartDateState(saved);
    setPhotos(photoList);
  }

  function handleRefresh() {
    setRefreshing(true);
    refreshAll().finally(() => setRefreshing(false));
  }

  const gridWidth = Math.min(windowWidth, MAX_WIDTH);
  const cellWidth = Math.max((gridWidth - 2 * GAP) / 3, 0);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.column}>
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#ffffff"
              colors={["#ffffff"]}
            />
          }>
          <Hero
            startDate={startDate}
            loadingDate={loadingDate}
            onEditDate={() => setPickerVisible(true)}
            onAddPhoto={handleAddPhoto}
            onOpenCalendar={() => router.push("/calendar")}
            onOpenWish={() => router.push("/wish")}
          />
          <View style={styles.grid}>
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                style={[styles.cell, { width: cellWidth }]}
                onPress={() =>
                  router.push({
                    pathname: "/photo/[id]",
                    params: { id: photo.id },
                  })
                }>
                <Image
                  source={{ uri: photo.image_url }}
                  style={styles.cellImage}
                  contentFit="cover"
                  transition={150}
                />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      <DatePickerModal
        visible={pickerVisible}
        initialValue={startDate ?? undefined}
        onClose={() => setPickerVisible(false)}
        onSave={async (date) => {
          await setStartDate(date);
          setStartDateState(date);
          setPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

function Hero({
  startDate,
  loadingDate,
  onEditDate,
  onAddPhoto,
  onOpenCalendar,
  onOpenWish,
}: {
  startDate: string | null;
  loadingDate: boolean;
  onEditDate: () => void;
  onAddPhoto: () => void;
  onOpenCalendar: () => void;
  onOpenWish: () => void;
}) {
  return (
    <View style={styles.hero}>
      <Text style={styles.logo}>share</Text>

      {loadingDate ? (
        <ActivityIndicator color="#ffffff" style={styles.ddayLoading} />
      ) : startDate ? (
        <Pressable style={styles.ddayWrap} onPress={onEditDate}>
          <Text style={styles.ddayDate}>시작일 {formatKoreanDate(startDate)}</Text>
          <View style={styles.ddayRow}>
            <Text style={styles.ddayNumber}>+{daysSince(startDate)}</Text>
            <Text style={styles.ddayUnit}>일</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable style={styles.ddayWrap} onPress={onEditDate}>
          <Text style={styles.ddayDate}>시작일 입력하기</Text>
          <View style={styles.ddayRow}>
            <Ionicons name="add" size={22} color="#ffffff" />
          </View>
        </Pressable>
      )}

      <View style={styles.iconRow}>
        <IconButton icon="add-circle" onPress={onAddPhoto} />
        <IconButton icon="calendar" onPress={onOpenCalendar} />
        <IconButton icon="heart" onPress={onOpenWish} />
      </View>
    </View>
  );
}

function IconButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.iconButton} onPress={onPress} hitSlop={6}>
      <Ionicons name={icon} size={20} color="#ffffff" />
    </Pressable>
  );
}

function DatePickerModal({
  visible,
  initialValue,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialValue?: string;
  onClose: () => void;
  onSave: (date: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible ? (
        <DateForm initialValue={initialValue} onClose={onClose} onSave={onSave} />
      ) : null}
    </Modal>
  );
}

function DateForm({
  initialValue,
  onClose,
  onSave,
}: {
  initialValue?: string;
  onClose: () => void;
  onSave: (date: string) => void;
}) {
  const [text, setText] = useState(initialValue ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const trimmed = text.trim();
    if (!isValidDateStr(trimmed)) {
      setError("날짜를 YYYY-MM-DD 형식으로 입력해주세요.");
      return;
    }
    if (trimmed > todayStr()) {
      setError("미래 날짜는 입력할 수 없어요.");
      return;
    }
    onSave(trimmed);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>시작 날짜 입력</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={palette.textFaint}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setError(null);
          }}
          keyboardType="numbers-and-punctuation"
          autoFocus
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable style={styles.todayButton} onPress={() => setText(todayStr())}>
          <Text style={styles.todayButtonText}>오늘로 채우기</Text>
        </Pressable>
        <View style={styles.modalActions}>
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>취소</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>저장</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  column: {
    flex: 1,
    height: "100%",
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
  },
  list: {
    flex: 1,
    height: "100%",
  },
  hero: {
    alignItems: "flex-start",
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  logo: {
    fontFamily: fontFamily.handwriting,
    fontSize: 40,
    color: palette.text,
  },
  ddayLoading: {
    alignSelf: "center",
    marginVertical: 20,
  },
  ddayWrap: {
    alignSelf: "center",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 14,
  },
  ddayDate: {
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: "600",
    marginBottom: 4,
  },
  ddayRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  ddayNumber: {
    fontSize: 22,
    fontWeight: "600",
    color: palette.text,
  },
  ddayUnit: {
    fontSize: 22,
    fontWeight: "600",
    color: palette.text,
  },
  iconRow: {
    flexDirection: "row",
    gap: 22,
  },
  iconButton: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  cell: {
    aspectRatio: 1,
    backgroundColor: palette.surfaceSolid,
    overflow: "hidden",
  },
  cellImage: {
    width: "100%",
    height: "100%",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: MODAL_MAX_WIDTH,
    backgroundColor: palette.surfaceSolid,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.text,
    marginBottom: 16,
  },
  input: {
    width: "100%",
    height: 52,
    backgroundColor: palette.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: palette.text,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: "#FFF0F0",
    fontWeight: "700",
  },
  todayButton: {
    alignSelf: "flex-start",
    marginTop: 10,
  },
  todayButtonText: {
    fontSize: 14,
    color: palette.text,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  saveButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.accentDark,
  },
});

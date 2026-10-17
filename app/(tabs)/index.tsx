import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette } from "@/constants/theme";
import { daysSince, formatKoreanDate, isValidDateStr, todayStr } from "@/lib/dates";
import { getStartDate, setStartDate } from "@/lib/storage";

export default function HomeScreen() {
  const [startDate, setStartDateState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const saved = await getStartDate();
        if (active) {
          setStartDateState(saved);
          setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        {startDate ? (
          <DdayView
            startDate={startDate}
            onEdit={() => setPickerVisible(true)}
          />
        ) : (
          <FirstRunView onAdd={() => setPickerVisible(true)} />
        )}
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

function DdayView({
  startDate,
  onEdit,
}: {
  startDate: string;
  onEdit: () => void;
}) {
  const days = daysSince(startDate);

  return (
    <View style={styles.ddayWrap}>
      <Text style={styles.smallText}>우리만의 기록</Text>
      <Text style={styles.label}>오늘은 만난 지</Text>
      <Text style={styles.dayText}>+{days}일</Text>

      <Pressable style={styles.startDateRow} onPress={onEdit}>
        <Text style={styles.startDateText}>
          시작일 {formatKoreanDate(startDate)}
        </Text>
        <Ionicons name="pencil" size={14} color={palette.accent} />
      </Pressable>
    </View>
  );
}

function FirstRunView({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.ddayWrap}>
      <Text style={styles.smallText}>우리만의 기록</Text>
      <Text style={styles.firstRunTitle}>우리의 시작 날짜를 정해볼까요?</Text>
      <Text style={styles.firstRunText}>
        시작일을 입력하면 매일 만난 날 수를 세어드려요.
      </Text>

      <Pressable style={styles.bigAddButton} onPress={onAdd}>
        <Ionicons name="add" size={40} color="#ffffff" />
      </Pressable>
    </View>
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
  const [text, setText] = useState(initialValue ?? "");
  const [error, setError] = useState<string | null>(null);

  // 모달이 열릴 때마다 입력값 초기화
  useEffect(() => {
    if (visible) {
      setText(initialValue ?? "");
      setError(null);
    }
  }, [visible, initialValue]);

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>시작 날짜 입력</Text>
          <Text style={styles.modalHint}>
            예: {todayStr()}
          </Text>

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  ddayWrap: {
    width: "100%",
    alignItems: "center",
  },
  smallText: {
    fontSize: 16,
    color: palette.accent,
    marginBottom: 24,
    fontWeight: "600",
  },
  label: {
    fontSize: 20,
    color: palette.textMuted,
    marginBottom: 8,
  },
  dayText: {
    fontSize: 64,
    fontWeight: "800",
    color: palette.text,
    marginBottom: 24,
  },
  startDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: palette.accentSoft,
    borderRadius: 999,
  },
  startDateText: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.accentDark,
  },
  firstRunTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.text,
    textAlign: "center",
    marginBottom: 12,
  },
  firstRunText: {
    fontSize: 16,
    color: palette.textMuted,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  bigAddButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
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
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.text,
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 14,
    color: palette.textFaint,
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
  inputError: {
    borderWidth: 1,
    borderColor: palette.accent,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: palette.danger,
    fontWeight: "600",
  },
  todayButton: {
    alignSelf: "flex-start",
    marginTop: 10,
  },
  todayButtonText: {
    fontSize: 14,
    color: palette.accent,
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
    color: palette.textMuted,
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
    color: "#ffffff",
  },
});

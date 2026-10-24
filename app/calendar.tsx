import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette } from "@/constants/theme";
import {
  addEvent,
  deleteEvent,
  loadEvents,
  updateEvent,
  type EventInput,
} from "@/lib/calendar";
import { formatKoreanDate, isPastDate, isValidDateStr, todayStr } from "@/lib/dates";
import { confirmDialog, showAlert } from "@/lib/dialog";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";

export default function CalendarScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  async function refresh() {
    try {
      const data = await loadEvents();
      setEvents(data);
    } catch (error) {
      showAlert(
        "일정 불러오기 오류",
        error instanceof Error ? error.message : "알 수 없는 오류"
      );
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [])
  );

  function openAdd() {
    setEditing(null);
    setFormVisible(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditing(event);
    setFormVisible(true);
  }

  function handleDelete(event: CalendarEvent) {
    confirmDialog("일정 삭제", `"${event.title}" 일정을 삭제할까요?`, {
      confirmText: "삭제",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteEvent(event.id);
          setEvents((prev) => prev.filter((e) => e.id !== event.id));
        } catch (error) {
          showAlert(
            "삭제 오류",
            error instanceof Error ? error.message : "알 수 없는 오류"
          );
        }
      },
    });
  }

  const today = todayStr();
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = events
    .filter((e) => e.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color="#ffffff" />
        </Pressable>
        <Text style={styles.title}>캘린더</Text>
        <Pressable style={styles.headerButton} onPress={openAdd} hitSlop={8}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color={palette.textFaint} />
          <Text style={styles.emptyTitle}>아직 일정이 없어요</Text>
          <Text style={styles.emptyText}>기념일이나 스케줄을 등록해보세요.</Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...(upcoming.length > 0
              ? [{ key: "upcoming-header", header: true as const }, ...upcoming]
              : []),
            ...(past.length > 0
              ? [{ key: "past-header", header: true as const }, ...past]
              : []),
          ]}
          keyExtractor={(item) =>
            "header" in item && item.header ? item.key : (item as CalendarEvent).id
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if ("header" in item && item.header) {
              const isUpcoming = item.key === "upcoming-header";
              return (
                <Text style={styles.sectionHeader}>
                  {isUpcoming ? "다가오는 일정" : "지난 일정"}
                </Text>
              );
            }

            const event = item as CalendarEvent;
            const done = isPastDate(event.date);

            return (
              <EventCard
                event={event}
                done={done}
                onEdit={() => openEdit(event)}
                onDelete={() => handleDelete(event)}
              />
            );
          }}
        />
      )}

      <EventFormModal
        visible={formVisible}
        editing={editing}
        onClose={() => setFormVisible(false)}
        onSave={async (input) => {
          try {
            if (editing) {
              await updateEvent(editing.id, input);
            } else {
              await addEvent(input);
            }
            setFormVisible(false);
            setLoading(true);
            await refresh();
          } catch (error) {
            showAlert(
              "저장 오류",
              error instanceof Error ? error.message : "알 수 없는 오류"
            );
          }
        }}
      />
    </SafeAreaView>
  );
}

function EventCard({
  event,
  done,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  done: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isAnniversary = event.type === "anniversary";

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View
          style={[styles.badge, isAnniversary ? styles.badgeAnniversary : styles.badgeSchedule]}>
          <Text
            style={[
              styles.badgeText,
              isAnniversary ? styles.badgeAnniversaryText : styles.badgeScheduleText,
            ]}>
            {isAnniversary ? "기념일" : "스케줄"}
          </Text>
        </View>

        <Text style={[styles.cardTitle, done && styles.cardTitleDone]}>{event.title}</Text>

        <Text style={[styles.cardDate, done && styles.cardDateDone]}>
          {formatKoreanDate(event.date)}
          {done ? " · 완료" : ""}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable style={styles.iconButton} onPress={onEdit} hitSlop={8}>
          <Ionicons name="pencil" size={18} color={palette.textMuted} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={palette.text} />
        </Pressable>
      </View>
    </View>
  );
}

function EventFormModal({
  visible,
  editing,
  onClose,
  onSave,
}: {
  visible: boolean;
  editing: CalendarEvent | null;
  onClose: () => void;
  onSave: (input: EventInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<CalendarEventType>("schedule");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setTitle(editing?.title ?? "");
    setDate(editing?.date ?? "");
    setType(editing?.type ?? "schedule");
    setError(null);
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("내용을 입력해주세요.");
      return;
    }
    if (!isValidDateStr(date.trim())) {
      setError("날짜를 YYYY-MM-DD 형식으로 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      await onSave({ title: trimmedTitle, type, date: date.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{editing ? "일정 수정" : "일정 추가"}</Text>

          <Text style={styles.fieldLabel}>내용</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 1주년, 제주도 여행"
            placeholderTextColor={palette.textFaint}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.fieldLabel}>종류</Text>
          <View style={styles.typeRow}>
            {(["schedule", "anniversary"] as CalendarEventType[]).map((t) => {
              const selected = type === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.typeChip, selected && styles.typeChipSelected]}
                  onPress={() => setType(t)}>
                  <Text
                    style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                    {t === "schedule" ? "스케줄" : "기념일"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>날짜</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={palette.textFaint}
            value={date}
            onChangeText={(v) => {
              setDate(v);
              setError(null);
            }}
            keyboardType="numbers-and-punctuation"
          />
          <Pressable style={styles.todayButton} onPress={() => setDate(todayStr())}>
            <Text style={styles.todayButtonText}>오늘로 채우기</Text>
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={palette.accentDark} />
              ) : (
                <Text style={styles.saveButtonText}>저장</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.text,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    color: palette.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.textFaint,
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardLeft: {
    flex: 1,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  badgeSchedule: {
    backgroundColor: palette.accentSoft,
  },
  badgeAnniversary: {
    backgroundColor: palette.accent,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  badgeScheduleText: {
    color: palette.text,
  },
  badgeAnniversaryText: {
    color: palette.accentDark,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: palette.text,
  },
  cardTitleDone: {
    color: palette.textFaint,
    textDecorationLine: "line-through",
  },
  cardDate: {
    marginTop: 4,
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: "600",
  },
  cardDateDone: {
    color: palette.textFaint,
    textDecorationLine: "line-through",
  },
  cardActions: {
    flexDirection: "row",
    gap: 4,
  },
  iconButton: {
    padding: 8,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.textMuted,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: palette.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: palette.text,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  typeChipSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
  },
  typeChipTextSelected: {
    color: palette.accentDark,
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
  errorText: {
    marginTop: 10,
    fontSize: 13,
    color: "#FFF0F0",
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

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

import { contentMaxWidth, palette } from "@/constants/theme";
import { confirmDialog, showAlert } from "@/lib/dialog";
import type { WishItem } from "@/lib/types";
import {
  addWish,
  deleteWish,
  loadWishes,
  toggleWishDone,
  updateWishText,
} from "@/lib/wishes";

export default function WishScreen() {
  const router = useRouter();
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<WishItem | null>(null);
  const [editText, setEditText] = useState("");
  const [editVisible, setEditVisible] = useState(false);

  async function refresh() {
    try {
      const data = await loadWishes();
      setWishes(data);
    } catch (error) {
      showAlert(
        "위시 불러오기 오류",
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

  async function handleAdd() {
    const text = draft.trim();
    if (!text || adding) {
      return;
    }
    setAdding(true);
    try {
      await addWish(text);
      setDraft("");
      setWishes(await loadWishes());
    } catch (error) {
      showAlert(
        "추가 오류",
        error instanceof Error ? error.message : "알 수 없는 오류"
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(wish: WishItem) {
    try {
      await toggleWishDone(wish.id, !wish.done);
      setWishes((prev) =>
        prev.map((w) => (w.id === wish.id ? { ...w, done: !w.done } : w))
      );
    } catch (error) {
      showAlert(
        "저장 오류",
        error instanceof Error ? error.message : "알 수 없는 오류"
      );
    }
  }

  function openEdit(wish: WishItem) {
    setEditing(wish);
    setEditText(wish.text);
    setEditVisible(true);
  }

  async function handleEditSave() {
    const text = editText.trim();
    if (!text || !editing) {
      return;
    }
    try {
      await updateWishText(editing.id, text);
      setEditVisible(false);
      setWishes((prev) =>
        prev.map((w) => (w.id === editing.id ? { ...w, text } : w))
      );
    } catch (error) {
      showAlert(
        "수정 오류",
        error instanceof Error ? error.message : "알 수 없는 오류"
      );
    }
  }

  function handleDelete(wish: WishItem) {
    confirmDialog("위시 삭제", `"${wish.text}" 항목을 삭제할까요?`, {
      confirmText: "삭제",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteWish(wish.id);
          setWishes((prev) => prev.filter((w) => w.id !== wish.id));
        } catch (error) {
          showAlert(
            "삭제 오류",
            error instanceof Error ? error.message : "알 수 없는 오류"
          );
        }
      },
    });
  }

  const doneCount = wishes.filter((w) => w.done).length;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.column}>
        <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color="#ffffff" />
        </Pressable>
        <Text style={styles.title}>위시</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="가고 싶은 곳, 하고 싶은 일"
          placeholderTextColor={palette.textFaint}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable style={styles.addButton} onPress={handleAdd} disabled={adding}>
          {adding ? (
            <ActivityIndicator size="small" color={palette.accentDark} />
          ) : (
            <Text style={styles.addButtonText}>추가</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : wishes.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color={palette.textFaint} />
          <Text style={styles.emptyTitle}>아직 위시가 없어요</Text>
          <Text style={styles.emptyText}>가고 싶은 곳과 하고 싶은 일을 적어보세요.</Text>
        </View>
      ) : (
        <>
          {doneCount > 0 ? (
            <Text style={styles.counter}>
              {wishes.length}개 중 {doneCount}개 완료
            </Text>
          ) : null}
          <FlatList
            data={wishes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <WishRow
                wish={item}
                onToggle={() => handleToggle(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => handleDelete(item)}
              />
            )}
          />
        </>
      )}
      </View>

      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>위시 수정</Text>
            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelButtonText}>취소</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleEditSave}>
                <Text style={styles.saveButtonText}>저장</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function WishRow({
  wish,
  onToggle,
  onEdit,
  onDelete,
}: {
  wish: WishItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.checkbox} onPress={onToggle} hitSlop={8}>
        {wish.done ? <Ionicons name="checkmark" size={18} color="#ffffff" /> : null}
      </Pressable>

      <Text style={[styles.cardText, wish.done && styles.cardTextDone]}>{wish.text}</Text>

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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: contentMaxWidth,
    alignSelf: "center",
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
  inputRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.border,
  },
  addButton: {
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: palette.accentDark,
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
  counter: {
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: "700",
    color: palette.textFaint,
    marginBottom: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: palette.text,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: palette.text,
  },
  cardTextDone: {
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
    maxWidth: 400,
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
  modalInput: {
    width: "100%",
    height: 50,
    backgroundColor: palette.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: palette.text,
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

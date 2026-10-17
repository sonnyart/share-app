import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette } from "@/constants/theme";
import { deletePhotos, loadPhotos } from "@/lib/photos";
import type { PhotoMemory } from "@/lib/types";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [photos, setPhotos] = useState<PhotoMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const photo = photos.find((p) => p.id === id) ?? null;

  const load = useCallback(async () => {
    try {
      const data = await loadPhotos();
      setPhotos(data);
    } catch (error) {
      Alert.alert(
        "사진 불러오기 오류",
        error instanceof Error ? error.message : "알 수 없는 오류"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }

  function confirmDelete(targets: PhotoMemory[]) {
    if (targets.length === 0) {
      return;
    }

    Alert.alert(
      "사진 삭제",
      `${targets.length}장의 사진을 삭제할까요?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deletePhotos(targets);

              // 현재 보고 있던 사진이 삭제되면 뒤로 이동
              if (targets.some((t) => t.id === id)) {
                router.back();
                return;
              }

              setPhotos((prev) => prev.filter((p) => !targets.some((t) => t.id === p.id)));
              setSelectMode(false);
              setSelectedIds(new Set());
            } catch (error) {
              Alert.alert(
                "삭제 오류",
                error instanceof Error ? error.message : "알 수 없는 오류"
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function deleteCurrent() {
    if (photo) {
      confirmDelete([photo]);
    }
  }

  const selected = photos.filter((p) => selectedIds.has(p.id));

  if (loading) {
    return (
      <View style={styles.darkScreen}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!photo && !selectMode) {
    return (
      <View style={styles.darkScreen}>
        <Text style={styles.notFoundText}>사진을 찾을 수 없어요</Text>
        <Pressable style={styles.notFoundButton} onPress={() => router.back()}>
          <Text style={styles.notFoundButtonText}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  if (selectMode) {
    return (
      <View style={[styles.darkScreen, { paddingTop: insets.top }]}>
        <View style={styles.selectionHeader}>
          <Pressable
            style={styles.headerButton}
            onPress={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            hitSlop={8}>
            <Text style={styles.headerButtonText}>취소</Text>
          </Pressable>

          <Text style={styles.selectionTitle}>{selected.length}장 선택</Text>

          <Pressable
            style={styles.headerButton}
            onPress={() => confirmDelete(selected)}
            disabled={selected.length === 0 || busy}
            hitSlop={8}>
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text
                style={[
                  styles.headerButtonText,
                  selected.length === 0 && styles.headerButtonDisabled,
                ]}>
                삭제
              </Text>
            )}
          </Pressable>
        </View>

        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <Pressable
                style={styles.cell}
                onPress={() => toggleSelect(item.id)}>
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.cellImage}
                  contentFit="cover"
                />
                {isSelected ? (
                  <View style={styles.cellDim} />
                ) : null}
                <View
                  style={[
                    styles.selectCircle,
                    isSelected && styles.selectCircleActive,
                  ]}>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    );
  }

  return (
    <ZoomablePhoto photo={photo!} insetsTop={insets.top}>
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable style={styles.circleButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </Pressable>

        <Pressable style={styles.circleButton} onPress={() => setMenuVisible(true)} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#ffffff" />
        </Pressable>
      </View>

      <View style={[styles.locationBadge, { bottom: insets.bottom + 24 }]}>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={13} color="#ffffff" />
          <Text style={styles.locationText}>{photo!.location}</Text>
        </View>
        <Text style={styles.dateText}>{photo!.date}</Text>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setMenuVisible(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable
              style={styles.sheetItem}
              onPress={() => {
                setMenuVisible(false);
                setSelectMode(true);
              }}>
              <Ionicons name="checkmark-circle-outline" size={22} color={palette.text} />
              <Text style={styles.sheetItemText}>사진 선택</Text>
            </Pressable>

            <View style={styles.sheetDivider} />

            <Pressable
              style={styles.sheetItem}
              onPress={() => {
                setMenuVisible(false);
                deleteCurrent();
              }}>
              <Ionicons name="trash-outline" size={22} color={palette.danger} />
              <Text style={[styles.sheetItemText, styles.sheetItemDanger]}>
                이 사진 삭제
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ZoomablePhoto>
  );
}

function ZoomablePhoto({
  photo,
  insetsTop,
  children,
}: {
  photo: PhotoMemory;
  insetsTop: number;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  function resetZoom() {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(
        Math.max(savedScale.value * e.scale, MIN_SCALE),
        MAX_SCALE
      );
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= MIN_SCALE + 0.01) {
        resetZoom();
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        resetZoom();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.darkScreen}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.zoomContainer, animatedStyle]}>
          <Image
            source={{ uri: photo.image_url }}
            style={styles.fullImage}
            contentFit="contain"
            transition={150}
          />
        </Animated.View>
      </GestureDetector>

      {children}
    </View>
  );
}

const GAP = 3;

const styles = StyleSheet.create({
  darkScreen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  zoomContainer: {
    flex: 1,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationBadge: {
    position: "absolute",
    right: 16,
    alignItems: "flex-end",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dateText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  notFoundText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  notFoundButton: {
    marginTop: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  notFoundButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    minWidth: 44,
    paddingVertical: 4,
  },
  headerButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  selectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  gridContent: {
    gap: GAP,
    paddingBottom: 24,
  },
  gridRow: {
    gap: GAP,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: "#1c1c1e",
    overflow: "hidden",
  },
  cellImage: {
    width: "100%",
    height: "100%",
  },
  cellDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  selectCircle: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectCircleActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  sheetItemText: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  sheetItemDanger: {
    color: palette.danger,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginHorizontal: 12,
  },
});

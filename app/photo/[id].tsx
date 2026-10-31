import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette } from "@/constants/theme";
import { confirmDialog, showAlert } from "@/lib/dialog";
import { deletePhotos, loadPhotos, NO_LOCATION, replacePhoto } from "@/lib/photos";
import type { PhotoMemory } from "@/lib/types";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

/** contain 핏으로 렌더링된 사진의 실제 표시 영역(빨간 테두리) 계산 */
function computePhotoRect(
  size: { w: number; h: number } | undefined,
  cellW: number,
  cellH: number
) {
  if (
    !size ||
    !Number.isFinite(size.w) ||
    !Number.isFinite(size.h) ||
    size.w <= 0 ||
    size.h <= 0
  ) {
    return { left: 0, top: 0, right: cellW, bottom: cellH };
  }

  const scale = Math.min(cellW / size.w, cellH / size.h);
  const dispW = size.w * scale;
  const dispH = size.h * scale;
  const left = (cellW - dispW) / 2;
  const top = (cellH - dispH) / 2;

  return { left, top, right: left + dispW, bottom: top + dispH };
}

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get("window");

  const [photos, setPhotos] = useState<PhotoMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<PhotoMemory>>(null);
  const [imageSizes, setImageSizes] = useState<Record<string, { w: number; h: number }>>(
    {}
  );

  const handleImageSize = useCallback((photoId: string, w: number, h: number) => {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return;
    }
    setImageSizes((prev) => {
      const existing = prev[photoId];
      if (existing && existing.w === w && existing.h === h) {
        return prev;
      }
      return { ...prev, [photoId]: { w, h } };
    });
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && first.index != null) {
        setIndex(first.index);
      }
    },
    []
  );

  useEffect(() => {
    let active = true;

    loadPhotos()
      .then((data) => {
        if (!active) {
          return;
        }
        const matching = data.filter((p) => p.group_id === id || p.id === id);
        setPhotos(matching.length > 0 ? matching : data);
        setIndex(0);
      })
      .catch((error) => {
        if (active) {
          showAlert(
            "사진 불러오기 오류",
            error instanceof Error ? error.message : "알 수 없는 오류"
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  const current = photos[index];

  const photoRectFor = useCallback(
    (photo: PhotoMemory) =>
      computePhotoRect(imageSizes[photo.id], width, height),
    [imageSizes, width, height]
  );

  const photoRect = current
    ? photoRectFor(current)
    : { left: 0, top: 0, right: width, bottom: height };

  function goPrev() {
    if (index > 0) {
      listRef.current?.scrollToOffset({
        offset: width * (index - 1),
        animated: true,
      });
    }
  }

  function goNext() {
    if (index < photos.length - 1) {
      listRef.current?.scrollToOffset({
        offset: width * (index + 1),
        animated: true,
      });
    }
  }

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

    confirmDialog("사진 삭제", `${targets.length}장의 사진을 삭제할까요?`, {
      confirmText: "삭제",
      destructive: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          await deletePhotos(targets);
          const currentDeleted = targets.some((t) => t.id === current?.id);

          if (currentDeleted) {
            router.back();
            return;
          }

          const remaining = photos.filter(
            (p) => !targets.some((t) => t.id === p.id)
          );
          setPhotos(remaining);
          setSelectMode(false);
          setSelectedIds(new Set());
        } catch (error) {
          showAlert(
            "삭제 오류",
            error instanceof Error ? error.message : "알 수 없는 오류"
          );
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function handleReplacePhoto() {
    if (!current) {
      return;
    }
    setMenuVisible(false);
    setBusy(true);
    try {
      const updated = await replacePhoto(current);
      if (updated) {
        setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } catch (error) {
      showAlert(
        "사진 수정 오류",
        error instanceof Error ? error.message : "알 수 없는 오류"
      );
    } finally {
      setBusy(false);
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
              <Pressable style={styles.cell} onPress={() => toggleSelect(item.id)}>
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.cellImage}
                  contentFit="cover"
                />
                {isSelected ? <View style={styles.cellDim} /> : null}
                <View
                  style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
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

  if (photos.length === 0 || !current) {
    return (
      <View style={styles.darkScreen}>
        <Text style={styles.notFoundText}>사진을 찾을 수 없어요</Text>
        <Pressable style={styles.notFoundButton} onPress={() => router.back()}>
          <Text style={styles.notFoundButtonText}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.darkScreen}>
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={photos}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScrollToIndexFailed={() => {}}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <ZoomablePhoto
              photo={item}
              photoRect={photoRectFor(item)}
              onZoomChange={setZoomed}
              onImageSize={(w, h) => handleImageSize(item.id, w, h)}
            />
          </View>
        )}
      />

      <Pressable
        style={[
          styles.edgeButton,
          {
            top: Math.max(photoRect.top + 8, insets.top + 8),
            left: photoRect.left + 8,
          },
        ]}
        onPress={() => router.back()}
        hitSlop={8}>
        <Ionicons name="close" size={26} color="#ffffff" />
      </Pressable>

      <Pressable
        style={[
          styles.edgeButton,
          {
            top: Math.max(photoRect.top + 8, insets.top + 8),
            left: photoRect.right - 8 - 40,
          },
        ]}
        onPress={() => setMenuVisible(true)}
        hitSlop={8}>
        <Ionicons name="ellipsis-horizontal" size={22} color="#ffffff" />
      </Pressable>

      <View
        style={[
          styles.counterWrap,
          { top: Math.max(photoRect.top + 12, insets.top + 12) },
        ]}
        pointerEvents="none">
        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>
            {index + 1} / {photos.length}
          </Text>
        </View>
      </View>

      {index > 0 ? (
        <Pressable
          style={[
            styles.sideButton,
            {
              left: photoRect.left + 8,
              top: (photoRect.top + photoRect.bottom) / 2 - 22,
            },
          ]}
          onPress={goPrev}
          hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </Pressable>
      ) : null}

      {index < photos.length - 1 ? (
        <Pressable
          style={[
            styles.sideButton,
            {
              left: photoRect.right - 8 - 44,
              top: (photoRect.top + photoRect.bottom) / 2 - 22,
            },
          ]}
          onPress={goNext}
          hitSlop={8}>
          <Ionicons name="chevron-forward" size={24} color="#ffffff" />
        </Pressable>
      ) : null}

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
              <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" />
              <Text style={styles.sheetItemText}>사진 선택</Text>
            </Pressable>

            <View style={styles.sheetDivider} />

            <Pressable style={styles.sheetItem} onPress={handleReplacePhoto}>
              <Ionicons name="swap-horizontal" size={22} color="#ffffff" />
              <Text style={styles.sheetItemText}>다른 사진으로 수정</Text>
            </Pressable>

            <View style={styles.sheetDivider} />

            <Pressable
              style={styles.sheetItem}
              onPress={() => {
                setMenuVisible(false);
                confirmDelete([current]);
              }}>
              <Ionicons name="trash-outline" size={22} color="#ffffff" />
              <Text style={styles.sheetItemText}>이 사진 삭제</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ZoomablePhoto({
  photo,
  photoRect,
  onZoomChange,
  onImageSize,
}: {
  photo: PhotoMemory;
  photoRect: { left: number; top: number; right: number; bottom: number };
  onZoomChange: (zoomed: boolean) => void;
  onImageSize?: (w: number, h: number) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const { width: cellWidth, height: cellHeight } = Dimensions.get("window");

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  function notifyZoom(next: boolean) {
    setZoomed(next);
    onZoomChange(next);
  }

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
        runOnJS(notifyZoom)(false);
      } else {
        runOnJS(notifyZoom)(true);
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
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
        runOnJS(notifyZoom)(false);
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
        runOnJS(notifyZoom)(true);
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
    <View style={styles.zoomCell}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.zoomContainer, animatedStyle]}>
          <Image
            source={{ uri: photo.image_url }}
            style={styles.fullImage}
            contentFit="contain"
            transition={150}
            onLoad={(e) => onImageSize?.(e.source.width, e.source.height)}
          />
        </Animated.View>
      </GestureDetector>

      <View
        style={[
          styles.locationBadge,
          {
            right: cellWidth - photoRect.right + 16,
            bottom: cellHeight - photoRect.bottom + 24,
          },
        ]}>
        {photo.location && photo.location !== NO_LOCATION ? (
          <View style={styles.locationRow}>
            <Ionicons name="location" size={13} color="#ffffff" />
            <Text style={styles.locationText}>{photo.location}</Text>
          </View>
        ) : null}
        <Text style={styles.dateText}>{photo.date}</Text>
      </View>
    </View>
  );
}

const GAP = 3;

const styles = StyleSheet.create({
  darkScreen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  zoomCell: {
    flex: 1,
  },
  zoomContainer: {
    flex: 1,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  locationBadge: {
    position: "absolute",
    alignItems: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
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
  edgeButton: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  counterWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  counterBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sideButton: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  counterText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    backgroundColor: "#1c1c1e",
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
    color: "#ffffff",
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 12,
  },
});

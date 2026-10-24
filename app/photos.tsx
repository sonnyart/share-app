import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { contentMaxWidth, palette } from "@/constants/theme";
import { showAlert } from "@/lib/dialog";
import { addPhotos, groupPhotos, loadPhotos } from "@/lib/photos";
import type { PhotoMemory } from "@/lib/types";

const GAP = 3;

export default function PhotosScreen() {
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const data = await loadPhotos();
          if (active) {
            setPhotos(data);
          }
        } catch (error) {
          if (active) {
            showAlert(
              "사진 불러오기 오류",
              error instanceof Error ? error.message : "알 수 없는 오류"
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  async function handleAddPhoto() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const added = await addPhotos();
      if (added.length > 0) {
        setPhotos(await loadPhotos());
      }
    } catch (error) {
      showAlert(
        "사진 추가 오류",
        error instanceof Error ? error.message : "알 수 없는 오류"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.column}>
        <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color="#ffffff" />
        </Pressable>
        <Text style={styles.title}>사진</Text>
        <Pressable
          style={styles.headerButton}
          onPress={handleAddPhoto}
          disabled={busy}
          hitSlop={8}>
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="add" size={28} color="#ffffff" />
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={48} color={palette.textFaint} />
          <Text style={styles.emptyTitle}>아직 사진이 없어요</Text>
          <Text style={styles.emptyText}>우측 상단 + 버튼으로 함께한 순간을 남겨보세요.</Text>
        </View>
      ) : (
        <FlatList
          data={groupPhotos(photos)}
          keyExtractor={(item) => item.key}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const thumb = item.photos[0];
            const isMulti = item.photos.length > 1;
            return (
              <Pressable
                style={styles.cell}
                onPress={() =>
                  router.push({
                    pathname: "/photo/[id]",
                    params: { id: item.key },
                  })
                }>
                <Image
                  source={{ uri: thumb.image_url }}
                  style={styles.cellImage}
                  contentFit="cover"
                  transition={150}
                />
                {isMulti ? (
                  <View style={styles.stackedBadge}>
                    <Ionicons name="copy" size={13} color="#ffffff" />
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
      </View>
    </SafeAreaView>
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
    backgroundColor: palette.surfaceSolid,
    borderRadius: 4,
    overflow: "hidden",
  },
  cellImage: {
    width: "100%",
    height: "100%",
  },
  stackedBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});

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

import { palette } from "@/constants/theme";
import { showAlert } from "@/lib/dialog";
import { addPhotos, loadPhotos } from "@/lib/photos";
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
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <Pressable
              style={styles.cell}
              onPress={() =>
                router.push({
                  pathname: "/photo/[id]",
                  params: { id: item.id },
                })
              }>
              <Image
                source={{ uri: item.image_url }}
                style={styles.cellImage}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
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
});

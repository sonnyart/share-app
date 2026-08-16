import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

const START_DATE = new Date("2026-06-06");

type PhotoMemory = {
  id: string;
  image_url: string;
  file_path: string;
  date: string;
  location: string;
};

type Wish = {
  text: string;
  done: boolean;
};

const ANNIVERSARIES = [
  { label: "1주년", days: 365 },
];

function getDaysTogether() {
  const today = new Date();
  const startTime = START_DATE.getTime();
  const todayTime = today.getTime();
  const diffTime = todayTime - startTime;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1;
}

function getDateAfterDays(days: number) {
  const date = new Date(START_DATE);
  date.setDate(START_DATE.getDate() + days - 1);

  return date;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}.${month}.${day}`;
}

function HomeTab() {
  const daysTogether = getDaysTogether();

  return (
    <View style={styles.homeBox}>
      <Text style={styles.smallText}>우리만의 기록</Text>
      <Text style={styles.label}>오늘은 만난 지</Text>
      <Text style={styles.dayText}>+{daysTogether}일</Text>
    </View>
  );
}

function PhotoTab() {
  const [photos, setPhotos] = useState<PhotoMemory[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMemory | null>(null);

  useEffect(() => {
    loadPhotos();
  }, []);

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setPhotos(data || []);
  }

  function formatPhotoDate(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year}.${month}.${day}`;
  }

  function getPhotoDateFromExif(exif: any) {
    const photoDate = exif?.DateTimeOriginal || exif?.DateTime;

    if (!photoDate) {
      return formatPhotoDate(new Date());
    }

    return String(photoDate).split(" ")[0].replaceAll(":", ".");
  }

  function getGpsNumber(value: any) {
    if (typeof value === "number") {
      return value;
    }

    if (Array.isArray(value)) {
      return value[0] + value[1] / 60 + value[2] / 3600;
    }

    return null;
  }

  async function getPhotoLocationText(exif: any) {
    const latitude = getGpsNumber(exif?.GPSLatitude);
    const longitude = getGpsNumber(exif?.GPSLongitude);

    if (latitude === null || longitude === null) {
      return "사진 위치 없음";
    }

    const fixedLatitude =
      exif?.GPSLatitudeRef === "S" ? -latitude : latitude;

    const fixedLongitude =
      exif?.GPSLongitudeRef === "W" ? -longitude : longitude;

    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude: fixedLatitude,
        longitude: fixedLongitude,
      });

      const address = addresses[0];

      if (!address) {
        return `${fixedLatitude.toFixed(4)}, ${fixedLongitude.toFixed(4)}`;
      }

      return (
        [address.city, address.district].filter(Boolean).join(" ") ||
        [address.region, address.country].filter(Boolean).join(" ") ||
        "사진 위치 있음"
      );
    } catch {
      return `${fixedLatitude.toFixed(4)}, ${fixedLongitude.toFixed(4)}`;
    }
  }

  async function addPhoto() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== "granted") {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      exif: true,
    });

    if (result.canceled) {
      return;
    }

    const selectedPhoto = result.assets[0];

    const base64 = await FileSystem.readAsStringAsync(
      selectedPhoto.uri,
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    const filePath = `${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(filePath, decode(base64), {
        contentType: "image/jpeg",
      });

    if (uploadError) {
      console.log(uploadError);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("photos")
      .getPublicUrl(filePath);

    const photoDate = getPhotoDateFromExif(selectedPhoto.exif);
    const locationText = await getPhotoLocationText(selectedPhoto.exif);

    const { error: insertError } = await supabase
      .from("photos")
      .insert({
        image_url: publicUrlData.publicUrl,
        file_path: filePath,
        date: photoDate,
        location: locationText,
      });

    if (insertError) {
      console.log(insertError);
      return;
    }

    loadPhotos();
  }

  async function deletePhoto(photoId: string, filePath: string) {
    await supabase.storage.from("photos").remove([filePath]);

    await supabase
      .from("photos")
      .delete()
      .eq("id", photoId);

    setSelectedPhoto(null);
    loadPhotos();
  }

  return (
    <View style={styles.photoBox}>
      <Text style={styles.emptyTitle}>사진</Text>

      <Text style={styles.emptyText}>
        함께한 순간을 사진으로 남겨봐요.
      </Text>

      <Pressable
        style={styles.addButton}
        onPress={addPhoto}
      >
        <Text style={styles.addButtonText}>
          사진 추가하기
        </Text>
      </Pressable>

      <View style={styles.photoList}>
        {photos.map((photo) => (
          <Pressable
            key={photo.id}
            style={styles.photoCard}
            onPress={() => setSelectedPhoto(photo)}
          >
            <Image
              source={{ uri: photo.image_url }}
              style={styles.photoImage}
            />

            <View style={styles.photoInfo}>
              <Text style={styles.photoText}>
                {photo.date}
              </Text>

              <Text style={styles.photoText}>
                {photo.location}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Modal
        visible={selectedPhoto !== null}
        transparent
        animationType="fade"
      >
        <View style={styles.modalBackground}>
          {selectedPhoto && (
            <View style={styles.modalContent}>
              <Image
                source={{ uri: selectedPhoto.image_url }}
                style={styles.fullPhoto}
                resizeMode="contain"
              />

              <View style={styles.fullPhotoInfo}>
                <Text style={styles.fullPhotoText}>
                  {selectedPhoto.date}
                </Text>

                <Text style={styles.fullPhotoText}>
                  {selectedPhoto.location}
                </Text>
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setSelectedPhoto(null)}
                >
                  <Text style={styles.closeButtonText}>
                    닫기
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.photoDeleteButton}
                  onPress={() =>
                    deletePhoto(
                      selectedPhoto.id,
                      selectedPhoto.file_path
                    )
                  }
                >
                  <Text style={styles.photoDeleteButtonText}>
                    삭제
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
function CalendarTab() {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyTitle}>캘린더</Text>
      <Text style={styles.emptyText}>
        생일과 기념일을 모아볼 공간이에요.
      </Text>
    </View>
  );
}
function WishTab() {
  const [wishText, setWishText] = useState("");
  const [wishes, setWishes] = useState<Wish[]>([]);

  useEffect(() => {
    loadWishes();
  }, []);

  async function loadWishes() {
    const savedWishes = await AsyncStorage.getItem("wishes");

    if (savedWishes) {
      setWishes(JSON.parse(savedWishes));
    }
  }

  async function saveWishes(nextWishes: Wish[]) {
    await AsyncStorage.setItem("wishes", JSON.stringify(nextWishes));
  }

  function addWish() {
  if (wishText.trim() === "") {
    return;
  }

  const nextWishes = [
    ...wishes,
    {
      text: wishText,
      done: false,
    },
  ];

  setWishes(nextWishes);
  saveWishes(nextWishes);
  setWishText("");
}

  function deleteWish(indexToDelete: number) {
  const nextWishes = wishes.filter((_, index) => index !== indexToDelete);

  setWishes(nextWishes);
  saveWishes(nextWishes);
}

function toggleWish(indexToToggle: number) {
  const nextWishes = wishes.map((wish, index) => {
    if (index === indexToToggle) {
      return { ...wish, done: !wish.done };
    }

    return wish;
  });

  setWishes(nextWishes);
  saveWishes(nextWishes);
}

  return (
    <View style={styles.wishBox}>
      <Text style={styles.emptyTitle}>위시 리스트</Text>
      <Text style={styles.emptyText}>가고 싶은 곳과 하고 싶은 일을 적어봐요.</Text>

      <TextInput
        style={styles.input}
        placeholder="예: 제주도 여행 가기"
        value={wishText}
        onChangeText={setWishText}
      />

      <Pressable style={styles.addButton} onPress={addWish}>
        <Text style={styles.addButtonText}>추가하기</Text>
      </Pressable>

    <View style={styles.wishList}>
  {wishes.map((wish, index) => (
    <View key={index} style={styles.wishItem}>
      <Text
        style={wish.done ? styles.wishItemTextDone : styles.wishItemText}
      >
        {wish.text}
      </Text>

      <View style={styles.wishActions}>
        <Pressable
          style={styles.doneButton}
          onPress={() => toggleWish(index)}
        >
          <Text style={styles.doneButtonText}>
            {wish.done ? "되돌리기" : "완료"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.deleteButton}
          onPress={() => deleteWish(index)}
        >
          <Text style={styles.deleteButtonText}>삭제</Text>
        </Pressable>
      </View>
    </View>
  ))}
</View>
      
      </View>
    
  );
}

export default function HomeScreen() {
  const [selectedTab, setSelectedTab] = useState("home");

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {selectedTab === "home" && <HomeTab />}
        {selectedTab === "photo" && <PhotoTab />}
        {selectedTab === "calendar" && <CalendarTab />}
        {selectedTab === "wish" && <WishTab />}
      </ScrollView>

      <View style={styles.tabBar}>
        <Pressable style={styles.tabButton} onPress={() => setSelectedTab("home")}>
          <Text style={selectedTab === "home" ? styles.tabTextActive : styles.tabText}>
            홈
          </Text>
        </Pressable>

        <Pressable style={styles.tabButton} onPress={() => setSelectedTab("photo")}>
          <Text style={selectedTab === "photo" ? styles.tabTextActive : styles.tabText}>
            사진
          </Text>
        </Pressable>

        <Pressable style={styles.tabButton} onPress={() => setSelectedTab("calendar")}>
          <Text
            style={selectedTab === "calendar" ? styles.tabTextActive : styles.tabText}
          >
            캘린더
          </Text>
        </Pressable>

        <Pressable style={styles.tabButton} onPress={() => setSelectedTab("wish")}>
          <Text style={selectedTab === "wish" ? styles.tabTextActive : styles.tabText}>
            위시
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff7f2",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    paddingBottom: 110,
  },
  homeBox: {
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
},
  smallText: {
    fontSize: 16,
    color: "#b36b5e",
    marginBottom: 24,
  },
  label: {
    fontSize: 20,
    color: "#7a5c55",
    marginBottom: 8,
  },
  dayText: {
    fontSize: 64,
    fontWeight: "800",
    color: "#2f2a28",
    marginBottom: 32,
  },
  cardList: {
    width: "100%",
    gap: 12,
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2f2a28",
  },
  cardDate: {
    marginTop: 6,
    fontSize: 14,
    color: "#9a7a72",
  },
  cardStatus: {
    fontSize: 18,
    fontWeight: "700",
    color: "#d46a5f",
  },
  emptyBox: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2f2a28",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    color: "#7a5c55",
    textAlign: "center",
    lineHeight: 24,
  },
  wishBox: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  input: {
    width: "100%",
    height: 52,
    backgroundColor: "#fff7f2",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#2f2a28",
    marginTop: 20,
  },
  addButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#d46a5f",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  photoBox: {
  width: "100%",
  backgroundColor: "#ffffff",
  borderRadius: 16,
  padding: 24,
  alignItems: "center",
},
photoList: {
  width: "100%",
  marginTop: 20,
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 4,
},
photoCard: {
  width: "32%",
  aspectRatio: 1,
  overflow: "hidden",
  backgroundColor: "#fff7f2",
},
photoImage: {
  width: "100%",
  height: "100%",
},
photoInfo: {
  position: "absolute",
  right: 6,
  bottom: 6,
  alignItems: "flex-end",
},
photoText: {
  color: "#ffffff",
  fontSize: 10,
  fontWeight: "800",
  textShadowColor: "rgba(0, 0, 0, 0.7)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
},
modalBackground: {
  flex: 1,
  backgroundColor: "rgba(0, 0, 0, 0.92)",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
},
modalContent: {
  width: "100%",
  height: "82%",
  alignItems: "center",
  justifyContent: "center",
},
fullPhoto: {
  width: "100%",
  height: "100%",
},
fullPhotoInfo: {
  position: "absolute",
  right: 14,
  bottom: 74,
  alignItems: "flex-end",
},
fullPhotoText: {
  color: "#ffffff",
  fontSize: 14,
  fontWeight: "800",
  textShadowColor: "rgba(0, 0, 0, 0.8)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
},
modalActions: {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 12,
  flexDirection: "row",
  justifyContent: "center",
  gap: 12,
},
closeButton: {
  backgroundColor: "#ffffff",
  borderRadius: 12,
  paddingVertical: 12,
  paddingHorizontal: 22,
},
closeButtonText: {
  color: "#2f2a28",
  fontSize: 15,
  fontWeight: "800",
},
photoDeleteButton: {
  backgroundColor: "#d46a5f",
  borderRadius: 12,
  paddingVertical: 12,
  paddingHorizontal: 22,
},
photoDeleteButtonText: {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: "800",
},
  wishList: {
    width: "100%",
    marginTop: 20,
    gap: 10,
  },
  wishItem: {
    width: "100%",
    backgroundColor: "#fff7f2",
    borderRadius: 14,
    padding: 16,
  },
  wishItemText: {
    fontSize: 16,
    color: "#2f2a28",
    fontWeight: "600",
  },
  wishItemTextDone: {
  fontSize: 16,
  color: "#a8948f",
  fontWeight: "600",
  textDecorationLine: "line-through",
},
wishActions: {
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 12,
},
doneButton: {
  backgroundColor: "#e5f1dc",
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
},
doneButtonText: {
  color: "#4f7d35",
  fontSize: 14,
  fontWeight: "800",
},
  deleteButton: {
  marginTop: 12,
  alignSelf: "flex-end",
  backgroundColor: "#f1d4cf",
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
},
deleteButtonText: {
  color: "#9b3f38",
  fontSize: 14,
  fontWeight: "800",
},
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    height: 64,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  tabButton: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9a7a72",
  },
  tabTextActive: {
    fontSize: 15,
    fontWeight: "800",
    color: "#d46a5f",
  },
});
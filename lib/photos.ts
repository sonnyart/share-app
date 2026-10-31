import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import type { PhotoGroup, PhotoMemory } from "@/lib/types";

/** 사진 전체 목록 (최신순) */
export async function loadPhotos(): Promise<PhotoMemory[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PhotoMemory[];
}

/** 사진을 한 페이지(그룹) 단위로 묶기. group_id가 있으면 그룹, 없으면(옛 사진) 낱장 처리 */
export function groupPhotos(photos: PhotoMemory[]): PhotoGroup[] {
  const map = new Map<string, PhotoMemory[]>();

  for (const photo of photos) {
    const key = photo.group_id ?? photo.id;
    const list = map.get(key) ?? [];
    list.push(photo);
    map.set(key, list);
  }

  return [...map.entries()].map(([key, list]) => ({ key, photos: list }));
}

/** group_id 컬럼이 uuid 타입이라, 유효한 UUID v4를 생성해야 함 */
function genId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatPhotoDate(date: Date): string {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

function getPhotoDateFromExif(exif: any): string {
  const photoDate = exif?.DateTimeOriginal || exif?.DateTime;

  if (!photoDate) {
    return formatPhotoDate(new Date());
  }

  return String(photoDate).split(" ")[0].replaceAll(":", ".");
}

/** 위치 정보가 없을 때 표시할 문구 */
export const NO_LOCATION = "위치 정보 없음";

function formatCoord(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/** 웹에서는 expo-location reverseGeocodeAsync를 지원하지 않으므로 OSM(Nominatim)으로 대체 */
async function reverseGeocodeWeb(
  latitude: number,
  longitude: number
): Promise<string> {
  const url =
    "https://nominatim.openstreetmap.org/reverse" +
    `?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=ko`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });

  if (!res.ok) {
    throw new Error(`geocode ${res.status}`);
  }

  const data = await res.json();
  const address = data?.address;

  if (!address) {
    throw new Error("no address");
  }

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county;
  const district = address.borough || address.suburb || address.district;
  const place = [city, district].filter(Boolean).join(" ");

  if (place) {
    return place;
  }

  const region = [address.state, address.country].filter(Boolean).join(" ");

  if (region) {
    return region;
  }

  throw new Error("no place name");
}

async function reverseGeocodeText(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    if (Platform.OS === "web") {
      return await reverseGeocodeWeb(latitude, longitude);
    }

    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    const address = addresses[0];

    if (!address) {
      return formatCoord(latitude, longitude);
    }

    return (
      [address.city, address.district].filter(Boolean).join(" ") ||
      [address.region, address.country].filter(Boolean).join(" ") ||
      formatCoord(latitude, longitude)
    );
  } catch {
    return formatCoord(latitude, longitude);
  }
}

function getGpsNumber(value: any): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (Array.isArray(value) && value.length >= 3) {
    return value[0] + value[1] / 60 + value[2] / 3600;
  }

  return null;
}

/** EXIF GPS 좌표를 읽어 장소명으로. GPS가 없거나 (0,0)이면 null */
async function getPhotoLocationText(exif: any): Promise<string | null> {
  const latitude = getGpsNumber(exif?.GPSLatitude);
  const longitude = getGpsNumber(exif?.GPSLongitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  const fixedLatitude = exif?.GPSLatitudeRef === "S" ? -latitude : latitude;
  const fixedLongitude = exif?.GPSLongitudeRef === "W" ? -longitude : longitude;

  if (fixedLatitude === 0 && fixedLongitude === 0) {
    return null;
  }

  return reverseGeocodeText(fixedLatitude, fixedLongitude);
}

/** 사진에 GPS가 없을 때 기기 현재 위치를 장소명으로 (권한 거부/실패 시 null) */
async function getDeviceLocationText(): Promise<string | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return reverseGeocodeText(
      position.coords.latitude,
      position.coords.longitude
    );
  } catch {
    return null;
  }
}

/** 웹/네이티브 공통으로 파일을 ArrayBuffer로 읽기 (웹은 fetch, 네이티브는 FileSystem) */
async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    return await res.arrayBuffer();
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decode(base64);
}

/** 사진 선택 → Storage 업로드 → DB 저장. 최대 10장, 취소 시 빈 배열 반환 */
const MAX_PHOTOS = 10;

export async function addPhotos(): Promise<PhotoMemory[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("사진 접근 권한이 필요해요.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: MAX_PHOTOS,
    quality: 0.8,
    exif: true,
  });

  if (result.canceled) {
    return [];
  }

  const assets = result.assets.slice(0, MAX_PHOTOS);
  const groupId = genId();
  const added: PhotoMemory[] = [];

  // 사진에 GPS가 없을 때 쓸 기기 현재 위치 (필요할 때 한 번만 조회)
  let fallbackLocation: string | null | undefined;
  async function getFallbackLocation() {
    if (fallbackLocation === undefined) {
      fallbackLocation = await getDeviceLocationText();
    }
    return fallbackLocation;
  }

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];

    const arrayBuffer = await readFileAsArrayBuffer(asset.uri);
    const filePath = `${Date.now()}-${i}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(filePath, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`사진 업로드 실패: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from("photos")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;
    const photoDate = getPhotoDateFromExif(asset.exif);
    const exifLocation = await getPhotoLocationText(asset.exif);
    const location =
      exifLocation ?? (await getFallbackLocation()) ?? NO_LOCATION;

    const { data: inserted, error: insertError } = await supabase
      .from("photos")
      .insert({
        image_url: imageUrl,
        file_path: filePath,
        date: photoDate,
        location,
        group_id: groupId,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`사진 저장 실패: ${insertError.message}`);
    }

    added.push(inserted as PhotoMemory);
  }

  return added;
}

/** 사진 한 장을 다른 사진으로 교체 (같은 id 유지, 새 파일 업로드 + 기존 파일 삭제). 취소 시 null */
export async function replacePhoto(photo: PhotoMemory): Promise<PhotoMemory | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("사진 접근 권한이 필요해요.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    exif: true,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  const arrayBuffer = await readFileAsArrayBuffer(asset.uri);
  const filePath = `${Date.now()}-replace.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(filePath, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`사진 업로드 실패: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from("photos")
    .getPublicUrl(filePath);

  const imageUrl = publicUrlData.publicUrl;
  const photoDate = getPhotoDateFromExif(asset.exif);
  const exifLocation = await getPhotoLocationText(asset.exif);
  const location =
    exifLocation ?? (await getDeviceLocationText()) ?? NO_LOCATION;

  const { data: updated, error: updateError } = await supabase
    .from("photos")
    .update({
      image_url: imageUrl,
      file_path: filePath,
      date: photoDate,
      location,
    })
    .eq("id", photo.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`사진 수정 실패: ${updateError.message}`);
  }

  if (photo.file_path) {
    const { error: removeError } = await supabase.storage
      .from("photos")
      .remove([photo.file_path]);

    if (removeError) {
      console.log("기존 파일 삭제 실패(무시):", removeError.message);
    }
  }

  return updated as PhotoMemory;
}

/** 여러 사진을 한 번에 삭제 (Storage + DB) */
export async function deletePhotos(photos: PhotoMemory[]): Promise<void> {
  const paths = photos.map((p) => p.file_path).filter(Boolean);
  const ids = photos.map((p) => p.id).filter(Boolean);

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("photos")
      .remove(paths);

    if (storageError) {
      throw new Error(`사진 파일 삭제 실패: ${storageError.message}`);
    }
  }

  if (ids.length > 0) {
    const { error: dbError } = await supabase
      .from("photos")
      .delete()
      .in("id", ids);

    if (dbError) {
      throw new Error(`사진 기록 삭제 실패: ${dbError.message}`);
    }
  }
}

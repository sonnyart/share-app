import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import type { PhotoMemory } from "@/lib/types";

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

function getGpsNumber(value: any): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (Array.isArray(value) && value.length >= 3) {
    return value[0] + value[1] / 60 + value[2] / 3600;
  }

  return null;
}

async function getPhotoLocationText(exif: any): Promise<string> {
  const latitude = getGpsNumber(exif?.GPSLatitude);
  const longitude = getGpsNumber(exif?.GPSLongitude);

  if (latitude === null || longitude === null) {
    return "위치 정보 없음";
  }

  const fixedLatitude = exif?.GPSLatitudeRef === "S" ? -latitude : latitude;
  const fixedLongitude = exif?.GPSLongitudeRef === "W" ? -longitude : longitude;

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
      `${fixedLatitude.toFixed(4)}, ${fixedLongitude.toFixed(4)}`
    );
  } catch {
    return `${fixedLatitude.toFixed(4)}, ${fixedLongitude.toFixed(4)}`;
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
  const added: PhotoMemory[] = [];

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
    const location = await getPhotoLocationText(asset.exif);

    const { data: inserted, error: insertError } = await supabase
      .from("photos")
      .insert({
        image_url: imageUrl,
        file_path: filePath,
        date: photoDate,
        location,
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
  const location = await getPhotoLocationText(asset.exif);

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

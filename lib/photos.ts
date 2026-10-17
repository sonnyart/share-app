import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

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

/** 사진 선택 → Storage 업로드 → DB 저장. 취소 시 null 반환 */
export async function addPhoto(): Promise<PhotoMemory | null> {
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

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const arrayBuffer = decode(base64);
  const filePath = `${Date.now()}.jpg`;

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

  return inserted as PhotoMemory;
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

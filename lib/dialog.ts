import { Alert, Platform } from "react-native";

/**
 * 크로스 플랫폼 알림/확인 다이얼로그.
 * 웹에서는 react-native의 Alert 버튼이 동작하지 않으므로
 * window.alert / window.confirm 으로 대체한다.
 */

export function showAlert(title: string, message?: string): void {
  if (Platform.OS === "web") {
    const w = globalThis as { alert?: (msg: string) => void };
    w.alert?.(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmDialog(
  title: string,
  message: string,
  options: {
    confirmText?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }
): void {
  if (Platform.OS === "web") {
    const w = globalThis as { confirm?: (msg: string) => boolean };
    const ok = w.confirm?.(`${title}\n\n${message}`);
    if (ok) {
      options.onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: "취소", style: "cancel" },
      {
        text: options.confirmText ?? "확인",
        style: options.destructive ? "destructive" : "default",
        onPress: options.onConfirm,
      },
    ]);
  }
}

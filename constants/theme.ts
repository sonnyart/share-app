/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const palette = {
  background: '#B76E79', // rose gold
  backgroundDark: '#96545F', // deeper rose gold
  surface: 'rgba(255, 255, 255, 0.16)',
  surfaceSolid: '#C98A93',
  border: 'rgba(255, 255, 255, 0.28)',
  text: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.88)',
  textFaint: 'rgba(255, 255, 255, 0.62)',
  accent: '#ffffff',
  accentDark: '#96545F',
  accentSoft: 'rgba(255, 255, 255, 0.22)',
  green: '#F4F9F0',
  greenSoft: 'rgba(255, 255, 255, 0.26)',
  danger: '#4A1C24',
  dangerSoft: 'rgba(0, 0, 0, 0.16)',
} as const;

export const fontFamily = {
  handwriting: 'Pacifico_400Regular',
} as const;

/** 웹에서 콘텐츠를 중앙 정렬할 최대 폭 (인스타 웹 기준) */
export const contentMaxWidth = 935;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

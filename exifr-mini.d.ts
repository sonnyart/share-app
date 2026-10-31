declare module "exifr/dist/mini.umd.js" {
  export interface ExifrGpsResult {
    latitude: number;
    longitude: number;
  }
  export function gps(
    data: ArrayBuffer | Uint8Array
  ): Promise<ExifrGpsResult | undefined>;
}

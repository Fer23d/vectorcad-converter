declare module "utif" {
  type TiffFrame = {
    width: number;
    height: number;
    t256?: number[];
    t257?: number[];
    t258?: number[];
    t262?: number[];
    t274?: number[];
    t277?: number[];
    t338?: number[];
    [key: string]: unknown;
  };

  const UTIF: {
    decode(buffer: ArrayBuffer): TiffFrame[];
    decodeImage(buffer: ArrayBuffer, frame: TiffFrame): void;
    toRGBA8(frame: TiffFrame): Uint8Array;
  };

  export default UTIF;
}

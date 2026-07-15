declare module "utif" {
  type TiffFrame = {
    width: number;
    height: number;
    t256?: number[];
    t257?: number[];
    t258?: number[];
    t259?: number[];
    t262?: number[];
    t266?: number[];
    t320?: number[];
    t274?: number[];
    t277?: number[];
    t278?: number[];
    t279?: number[];
    t284?: number[];
    t338?: number[];
    t339?: number[];
    t273?: number[];
    t322?: number[];
    t323?: number[];
    t324?: number[];
    t325?: number[];
    data?: Uint8Array;
    [key: string]: unknown;
  };

  const UTIF: {
    decode(buffer: ArrayBuffer): TiffFrame[];
    decodeImage(buffer: ArrayBuffer, frame: TiffFrame): void;
    toRGBA8(frame: TiffFrame): Uint8Array;
  };

  export default UTIF;
}

declare module "utif" {
  type TiffFrame = {
    width: number;
    height: number;
    [key: string]: unknown;
  };

  const UTIF: {
    decode(buffer: ArrayBuffer): TiffFrame[];
    decodeImage(buffer: ArrayBuffer, frame: TiffFrame): void;
    toRGBA8(frame: TiffFrame): Uint8Array;
  };

  export default UTIF;
}

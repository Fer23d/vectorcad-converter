declare module "dxf" {
  export class Helper {
    constructor(content: string);
    toSVG(): string;
    toPolylines(): { polylines: Array<{ vertices: Array<{ x: number; y: number }> }> };
  }
}

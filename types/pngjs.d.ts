declare module "pngjs" {
  export class PNG {
    constructor(options: { width: number; height: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(buffer: Buffer): { width: number; height: number; data: Buffer };
      write(png: PNG, options?: { colorType?: number }): Buffer;
    };
  }
}

import jpeg from "jpeg-js";
import { PNG } from "pngjs";

type Raster = { width: number; height: number; data: Buffer };

function decode(mime: string, input: Buffer): Raster {
  if (mime === "image/jpeg" || (input[0] === 0xff && input[1] === 0xd8)) {
    const decoded = jpeg.decode(input, { useTArray: true, formatAsRGBA: true });
    return { width: decoded.width, height: decoded.height, data: Buffer.from(decoded.data) };
  }
  const png = PNG.sync.read(input);
  return { width: png.width, height: png.height, data: Buffer.from(png.data) };
}

function encode(image: Raster): Buffer {
  const png = new PNG({ width: image.width, height: image.height });
  image.data.copy(png.data);
  return PNG.sync.write(png, { colorType: 6 });
}

function fit(image: Raster, maxSide: number): Raster {
  const scale = Math.min(1, maxSide / image.width, maxSide / image.height);
  if (scale >= 1) return image;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(image.height - 1, Math.floor(y * image.height / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, Math.floor(x * image.width / width));
      image.data.copy(data, (y * width + x) * 4, (sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4);
    }
  }
  return { width, height, data };
}

function round(image: Raster, radius: number): Raster {
  const r = Math.min(radius, Math.floor(Math.min(image.width, image.height) / 2));
  if (r <= 0) return image;
  const data = Buffer.from(image.data);
  const inside = (x: number, y: number) => {
    const dx = x < r ? r - x : x >= image.width - r ? x - (image.width - r - 1) : 0;
    const dy = y < r ? r - y : y >= image.height - r ? y - (image.height - r - 1) : 0;
    return dx * dx + dy * dy <= r * r;
  };
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!inside(x, y)) data[(y * image.width + x) * 4 + 3] = 0;
    }
  }
  return { ...image, data };
}

function pad(image: Raster, padding: number): Raster {
  if (padding <= 0) return image;
  const width = image.width + padding * 2;
  const height = image.height + padding * 2;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < image.height; y++) {
    image.data.copy(data, ((y + padding) * width + padding) * 4, y * image.width * 4, (y + 1) * image.width * 4);
  }
  return { width, height, data };
}

/** Pure JS stand-in for the sharp styling path. No native canvas and no libvips. */
export function styleRaster(mime: string, input: Buffer, options: { radius: number; padding: number }): Buffer {
  if (input.length > 550000) throw new Error("Image exceeds supported size");
  let image = fit(decode(mime, input), 1200);
  image = round(image, options.radius);
  image = pad(image, options.padding);
  let bytes = encode(image);
  for (let pass = 0; bytes.length > 540000 && pass < 6; pass++) {
    image = fit(image, Math.max(1, Math.round(image.width * 0.8)));
    bytes = encode(image);
  }
  if (bytes.length > 550000) throw new Error("Styled image exceeds export size; reduce dimensions");
  return bytes;
}

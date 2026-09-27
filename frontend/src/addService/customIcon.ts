/**
 * 自定义图标上限边长。
 *
 * 服务列表的图标最终写进 localStorage（纳管服务是本地持久化的），
 * 而原图动辄几百 KB 到几 MB，几张就顶到配额。图标在界面上只显示 21 到 38px，
 * 128 已经覆盖 2 倍屏，再多是纯浪费。
 */
export const CUSTOM_ICON_MAX_SIZE = 128;

/**
 * 把任意尺寸的图片缩到 128px 以内并转成 PNG data URL。
 *
 * SVG 原样返回：矢量不需要重采样，栅格化反而会糊。
 * 解码失败（损坏文件、浏览器不认的格式，例如部分 ICO）会抛错，由调用方提示。
 */
export async function normalizeIconDataUrl(
  source: string,
  size = CUSTOM_ICON_MAX_SIZE,
): Promise<string> {
  if (source.startsWith('data:image/svg+xml')) {
    return source;
  }

  const image = await loadImage(source);
  const natural = Math.max(image.naturalWidth, image.naturalHeight, 1);
  const scale = Math.min(1, size / natural);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('canvas 2d context unavailable');
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image decode failed'));
    image.src = src;
  });
}

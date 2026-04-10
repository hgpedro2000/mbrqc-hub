/**
 * Compresses an image file using canvas.
 * Max dimension: 1920px (maintains aspect ratio).
 * Output: JPEG at 0.82 quality.
 */
export async function compressImage(file: File): Promise<File> {
  // Skip non-image files
  if (!file.type.startsWith("image/")) return file;

  const MAX_DIM = 1920;
  const QUALITY = 0.82;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only resize if larger than MAX_DIM
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedName = file.name.replace(/\.[^.]+$/, ".jpg");
          const compressed = new File([blob], compressedName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          // Only use compressed if actually smaller
          resolve(compressed.size < file.size ? compressed : file);
        },
        "image/jpeg",
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Compress multiple image files.
 */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage));
}

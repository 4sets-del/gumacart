import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

// Phone cameras produce 3-5 MB photos. Shrinking to at most `maxSize` px on
// the longest side keeps them sharp on a phone screen at ~10% of the size.
export async function compressImage(uri, { maxSize = 1280, quality = 0.7 } = {}) {
  try {
    let image = await ImageManipulator.manipulate(uri).renderAsync();
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    // Only shrink: never enlarge small photos, and keep the aspect ratio.
    if (scale < 1) {
      image = await ImageManipulator.manipulate(uri)
        .resize({ width: Math.round(image.width * scale), height: Math.round(image.height * scale) })
        .renderAsync();
    }
    const result = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    return result.uri;
  } catch (e) {
    // If compression fails for any reason, fall back to the original file.
    return uri;
  }
}

function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

// Uploads a local file to Firebase Storage and returns its download URL.
// Images are compressed first unless `compress` is false (e.g. videos,
// voice messages); `contentType` labels non-image files (e.g. 'audio/mp4').
export async function uploadFile(uri, path, { compress = true, contentType, ...options } = {}) {
  const localUri = compress ? await compressImage(uri, options) : uri;
  const blob = await uriToBlob(localUri);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, compress ? { contentType: 'image/jpeg' } : contentType ? { contentType } : undefined);
  return getDownloadURL(storageRef);
}

// Runs fn over items at most `limit` at a time and returns the results in
// order. Used for photo uploads: each photo is decoded and compressed in
// memory first, so uploading dozens at once can run a phone out of memory.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

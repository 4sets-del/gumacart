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
// Images are compressed first unless `compress` is false (e.g. videos).
export async function uploadFile(uri, path, { compress = true, ...options } = {}) {
  const localUri = compress ? await compressImage(uri, options) : uri;
  const blob = await uriToBlob(localUri);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, compress ? { contentType: 'image/jpeg' } : undefined);
  return getDownloadURL(storageRef);
}

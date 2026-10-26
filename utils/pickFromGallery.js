import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Android's newer photo picker only lists a few albums (Camera, Screenshots,
// Downloads), so photos saved by Messenger, Facebook and other apps are hard
// to find. The "legacy" picker is the phone's own file picker: it shows every
// album and folder, and can also open Gallery or Google Photos.
// It can't enforce a selection limit, so on Android every picked item is
// returned and the caller trims the list (and can say so).
export function pickFromGallery(options) {
  if (Platform.OS !== 'android') return ImagePicker.launchImageLibraryAsync(options);
  return ImagePicker.launchImageLibraryAsync({ ...options, legacy: true, selectionLimit: 0 });
}

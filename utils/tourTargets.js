// Lets the Home tour spotlight things that live outside the Home screen,
// like the bottom tab bar (registered by AppNavigator).
export const tabBarRef = { current: null };

const TAB_COUNT = 5;
const TAB_HEIGHT = 64; // icon + label, without the phone's gesture bar

// A stand-in "ref" for one tab button: measures the whole tab bar and returns
// the slice for tab `index` (tabs are equally wide).
export function tabTarget(index) {
  return {
    current: {
      measureInWindow(cb) {
        const bar = tabBarRef.current;
        if (!bar?.measureInWindow) return cb(0, 0, 0, 0);
        bar.measureInWindow((x, y, w, h) => cb(x + (w / TAB_COUNT) * index, y, w / TAB_COUNT, Math.min(h, TAB_HEIGHT)));
      },
    },
  };
}

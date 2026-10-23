import React, { useEffect, useRef } from 'react';
import { ScrollView, TextInput, Keyboard, Platform } from 'react-native';

const GAP = 24; // space kept between the field and the keyboard

// A ScrollView for forms: when the keyboard opens, it scrolls just enough to
// keep the field being typed in visible above it. Use it inside a
// KeyboardAvoidingView (which shrinks the screen); this then makes sure the
// focused field isn't left behind the keyboard.
export default function KeyboardScrollView({ onScroll, onLayout, children, ...props }) {
  const ref = useRef(null);
  const offset = useRef(0);
  const height = useRef(0);

  useEffect(() => {
    const reveal = () => {
      const input = TextInput.State.currentlyFocusedInput?.();
      const content = ref.current?.getInnerViewRef?.();
      if (!input?.measureLayout || !content) return;
      // Position of the field inside this scroll view's content. Fails (and
      // we do nothing) if the field belongs to a different screen or sheet.
      input.measureLayout(
        content,
        (x, y, w, h) => {
          const top = offset.current;
          const bottom = top + height.current;
          if (y + h + GAP > bottom) ref.current?.scrollTo({ y: y + h + GAP - height.current, animated: true });
          else if (y - GAP < top) ref.current?.scrollTo({ y: Math.max(y - GAP, 0), animated: true });
        },
        () => {},
      );
    };
    // Wait a moment so the screen has finished shrinking for the keyboard.
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTimeout(reveal, 120));
    return () => show.remove();
  }, []);

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={32}
      {...props}
      onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; onScroll?.(e); }}
      onLayout={(e) => { height.current = e.nativeEvent.layout.height; onLayout?.(e); }}
    >
      {children}
    </ScrollView>
  );
}

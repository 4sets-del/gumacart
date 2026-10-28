import React, { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import Ionicons from '@expo/vector-icons/Ionicons';

// The player only exists while the modal is open, so closing it stops the
// video (and its sound) right away.
function Player({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      style={styles.video}
      player={player}
      nativeControls
      allowsFullscreen
      allowsPictureInPicture={false}
      contentFit="contain"
    />
  );
}

// Full-screen video (listing videos). Shown while `uri` is set.
export default function VideoPlayerModal({ uri, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.wrap}>
        {uri ? <Player uri={uri} /> : null}
        <TouchableOpacity
          style={[styles.close, { top: insets.top + 10 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close video"
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// A muted, looping video preview (`playing` pauses / resumes it).
function useMutedLoop(uri, playing) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    try { if (playing) player.play(); else player.pause(); } catch (e) {}
  }, [playing, player]);
  return player;
}

// A video inside a listing's photo swiper, like Shopee: plays muted and on a
// loop while it's the slide on screen (`active`), paused otherwise. The
// speaker button turns the sound on/off right there; tapping anywhere else
// opens it full screen (onPress).
export function InlineVideo({ uri, active, style, onPress }) {
  const player = useMutedLoop(uri, active);
  const [muted, setMuted] = useState(true);
  useEffect(() => { try { player.muted = muted; } catch (e) {} }, [muted, player]);
  useEffect(() => { if (!active) setMuted(true); }, [active]); // swiping away mutes it again
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={style} accessibilityRole="button" accessibilityLabel="Open video full screen">
      <VideoView style={StyleSheet.absoluteFill} player={player} nativeControls={false} contentFit="cover" pointerEvents="none" />
      <TouchableOpacity
        style={styles.muteBtn}
        onPress={() => setMuted((m) => !m)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={muted ? "Turn sound on" : "Turn sound off"}
      >
        <Ionicons name={muted ? "volume-mute" : "volume-high"} size={18} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// A small square video in photo rows (Create Listing, listing thumbnails):
// the video itself playing muted on a loop, with a small video badge.
export function VideoTile({ uri, size = 64, radius = 10, onPress, children, style, playing = true }) {
  const player = useMutedLoop(uri, playing);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.tile, { width: size, height: size, borderRadius: radius }, style]}
      accessibilityRole="button"
      accessibilityLabel="Video"
    >
      <VideoView style={StyleSheet.absoluteFill} player={player} nativeControls={false} contentFit="cover" pointerEvents="none" />
      <View style={styles.tileBadge}>
        <Ionicons name="videocam" size={Math.max(11, Math.round(size * 0.16))} color="#fff" />
      </View>
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  close: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tile: { backgroundColor: '#1F2D24', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  muteBtn: { position: 'absolute', bottom: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  tileBadge: { position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
});

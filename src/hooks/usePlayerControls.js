import { useEffect, useState } from 'react';

// Shuffle / repeat / volume state + actions from Spicetify.Player. These have no dedicated
// events, so we sync on song/playpause changes and poll lightly while mounted.
const P = () => window.Spicetify?.Player;

function snapshot() {
  const p = P();
  if (!p) return { shuffle: false, smartShuffle: false, repeat: 0, volume: 1, muted: false };
  const d = p.data || {};
  return {
    shuffle: typeof p.getShuffle === 'function' ? !!p.getShuffle() : !!d.shuffle,
    smartShuffle: !!d.smartShuffle,
    repeat: typeof p.getRepeat === 'function' ? p.getRepeat() : d.repeat || 0,
    volume: typeof p.getVolume === 'function' ? p.getVolume() : 1,
    muted: typeof p.getMute === 'function' ? !!p.getMute() : false,
  };
}

export function usePlayerControls() {
  const [s, setS] = useState(snapshot);

  useEffect(() => {
    const p = P();
    if (!p) return;
    const sync = () => setS(snapshot());
    const events = ['songchange', 'onplaypause'];
    events.forEach((e) => p.addEventListener?.(e, sync));
    const id = setInterval(sync, 1000);
    sync();
    return () => {
      events.forEach((e) => p.removeEventListener?.(e, sync));
      clearInterval(id);
    };
  }, []);

  // Optimistic local update, then re-read shortly after to confirm the player applied it.
  const refresh = () => setTimeout(() => setS(snapshot()), 60);

  return {
    ...s,
    toggleShuffle: () => {
      P()?.setShuffle?.(!snapshot().shuffle);
      refresh();
    },
    cycleRepeat: () => {
      P()?.setRepeat?.((snapshot().repeat + 1) % 3);
      refresh();
    },
    setVolume: (v) => {
      P()?.setVolume?.(v);
      setS((prev) => ({ ...prev, volume: v }));
    },
    toggleMute: () => {
      P()?.toggleMute?.();
      refresh();
    },
  };
}

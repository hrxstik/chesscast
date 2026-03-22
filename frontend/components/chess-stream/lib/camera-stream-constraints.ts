/** Согласовано с UI контейнером 3:4 (`stream-config.ts`). */
export const CHESS_STREAM_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'environment',
  width: { ideal: 1440 },
  height: { ideal: 1080 },
  aspectRatio: { ideal: 3 / 4 },
};

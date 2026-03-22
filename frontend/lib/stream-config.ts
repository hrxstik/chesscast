/**
 * Должно совпадать с ideal aspectRatio в getUserMedia (chess-video-stream-webrtc).
 * Портрет 3:4 — типичный запрос камеры для съёмки доски с телефона.
 */
export const STREAM_VIDEO_ASPECT_RATIO = 3 / 4;

/** Tailwind: контейнер под превью камеры / входящий поток */
export const streamVideoContainerClass =
  'relative w-full max-h-[min(85vh,920px)] overflow-hidden rounded-xl bg-black aspect-[3/4]';

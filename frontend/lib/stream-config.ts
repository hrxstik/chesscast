/**
 * Должно совпадать с ideal aspectRatio в getUserMedia (chess-video-stream-webrtc).
 * Портрет 3:4 — типичный запрос камеры для съёмки доски с телефона.
 */
export const STREAM_VIDEO_ASPECT_RATIO = 3 / 4;

/** ~10 FPS для CV-кадров на backend */
export const CV_FRAME_INTERVAL_MS = 100;

/** Сколько одинаковых FEN подряд нужно для обновления виртуальной доски */
export const BOARD_FEN_STABLE_FRAMES = 10;

/** Tailwind: контейнер под превью камеры / входящий поток */
export const streamVideoContainerClass =
  'relative w-full max-h-[min(85vh,920px)] overflow-hidden rounded-xl bg-black aspect-[3/4]';

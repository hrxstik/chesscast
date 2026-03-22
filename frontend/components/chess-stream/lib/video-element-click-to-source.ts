/**
 * Клик по <video> с object-fit: contain → координаты в пикселях исходного кадра (videoWidth × videoHeight).
 * Возвращает null, если клик в letterbox.
 */
export function videoElementClickToSourceCoords(
  video: HTMLVideoElement,
  clientX: number,
  clientY: number,
): { imgX: number; imgY: number } | null {
  const rect = video.getBoundingClientRect();
  const clickX = clientX - rect.left;
  const clickY = clientY - rect.top;
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) {
    return null;
  }
  const videoAspect = videoWidth / videoHeight;
  const containerAspect = rect.width / rect.height;

  let imgX: number;
  let imgY: number;
  if (videoAspect > containerAspect) {
    const displayedWidth = rect.width;
    const displayedHeight = rect.width / videoAspect;
    const offsetY = (rect.height - displayedHeight) / 2;
    if (clickY < offsetY || clickY > offsetY + displayedHeight) {
      return null;
    }
    const scale = videoWidth / displayedWidth;
    imgX = clickX * scale;
    imgY = (clickY - offsetY) * scale;
  } else {
    const displayedWidth = rect.height * videoAspect;
    const displayedHeight = rect.height;
    const offsetX = (rect.width - displayedWidth) / 2;
    if (clickX < offsetX || clickX > offsetX + displayedWidth) {
      return null;
    }
    const scale = videoHeight / displayedHeight;
    imgX = (clickX - offsetX) * scale;
    imgY = clickY * scale;
  }
  return { imgX, imgY };
}

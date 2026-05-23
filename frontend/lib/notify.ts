import toast from 'react-hot-toast';

/** Понятные сообщения вместо сырых ошибок браузера/API. */
export function humanizeErrorMessage(message: string): string {
  const m = message.trim();
  if (!m) return 'Произошла ошибка';
  if (m === 'Permission dismissed' || m === 'NotAllowedError') {
    return 'Доступ к камере не предоставлен';
  }
  if (m === 'Permission denied') {
    return 'Доступ к камере запрещен';
  }
  if (m === 'NotFoundError' || m.includes('Requested device not found')) {
    return 'Камера не найдена на устройстве';
  }
  if (m === 'NotReadableError') {
    return 'Камера занята другим приложением';
  }
  if (m === 'Authorization token missing') {
    return 'Требуется вход в аккаунт';
  }
  if (m === 'Refresh token missing') {
    return '';
  }
  return m;
}

export function notifyError(message: string): void {
  const text = humanizeErrorMessage(message);
  if (!text) return;
  toast.error(text);
}

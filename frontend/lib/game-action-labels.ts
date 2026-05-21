export function getConductButtonLabel(status: string): string {
  if (status === 'IN_PROGRESS') return 'Продолжить трансляцию';
  return 'Вести трансляцию';
}

export function getWatchButtonLabel(status: string): string {
  if (status === 'PENDING') return 'Открыть трансляцию';
  return 'Смотреть';
}

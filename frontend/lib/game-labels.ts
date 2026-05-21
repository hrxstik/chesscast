/** Русские подписи для enum-полей партии в UI */

export const GAME_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает начала',
  IN_PROGRESS: 'Идёт трансляция',
  FINISHED: 'Завершена',
};

export const GAME_VISIBILITY_LABELS: Record<string, string> = {
  PRIVATE: 'Закрытая',
  PUBLIC: 'Публичная',
};

export const GAME_RESULT_LABELS: Record<string, string> = {
  WHITE_WIN: 'Победа белых',
  BLACK_WIN: 'Победа чёрных',
  DRAW: 'Ничья',
  STALEMATE: 'Пат',
  CANCELLED: 'Отменена',
  WHITE_RESIGN: 'Белые сдались',
  BLACK_RESIGN: 'Чёрные сдались',
  WHITE_TIME_OUT: 'Время у белых',
  BLACK_TIME_OUT: 'Время у чёрных',
  WHITE_LOSE: 'Поражение белых',
  BLACK_LOSE: 'Поражение чёрных',
};

export function labelStatus(v: string) {
  return GAME_STATUS_LABELS[v] ?? v;
}

export function labelVisibility(v: string) {
  return GAME_VISIBILITY_LABELS[v] ?? v;
}

export function labelResult(v: string) {
  return GAME_RESULT_LABELS[v] ?? v;
}

export function labelGameScope(organizationId: number | null | undefined) {
  return organizationId != null ? 'Организация' : 'Личная';
}

export const ORG_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  PLAYER: 'Участник',
};

export const PLATFORM_ROLE_LABELS: Record<string, string> = {
  USER: 'Игрок',
  SUPERADMIN: 'Супер-администратор',
};

export const JOIN_POLICY_LABELS: Record<string, string> = {
  OPEN: 'Открытая',
  INVITE_ONLY: 'По приглашению',
};

export const PIECE_COLOR_LABELS: Record<string, string> = {
  WHITE: 'белые',
  BLACK: 'чёрные',
};

export function labelOrgRole(v: string) {
  return ORG_ROLE_LABELS[v] ?? 'Участник';
}

export function labelPlatformRole(v: string) {
  return PLATFORM_ROLE_LABELS[v] ?? 'Игрок';
}

export function labelJoinPolicy(v: string) {
  return JOIN_POLICY_LABELS[v] ?? v;
}

export function labelPieceColor(v: string) {
  return PIECE_COLOR_LABELS[v] ?? v;
}

/** Короткая подпись роли в списках (поиск орг и т.п.). */
export function labelOrgRoleShort(v: string) {
  return v === 'ADMIN' ? 'админ' : 'участник';
}

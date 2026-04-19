import { IsBoolean, IsString, MinLength } from 'class-validator';

export class SetBlockedDto {
  @IsBoolean()
  blocked: boolean;

  /** Обязательна и при блокировке, и при разблокировке (аудит). */
  @IsString()
  @MinLength(3, { message: 'Причина не короче 3 символов' })
  reason: string;
}

import { IsOptional, IsString, MinLength } from 'class-validator';

/** Refresh из HttpOnly cookie; тело опционально для обратной совместимости. */
export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  refresh_token?: string;
}

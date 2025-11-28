import { IsEnum, IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { GameMode } from '@prisma/client';

export class CreateGameDto {
  @IsEnum(GameMode)
  mode: GameMode;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  organizationId?: number;
}

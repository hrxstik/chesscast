import { IsEnum, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { GameMode, GameVisibility } from '@prisma/client';

export class CreateGameDto {
  @IsEnum(GameMode)
  mode: GameMode;

  @IsOptional()
  @IsEnum(GameVisibility)
  visibility?: GameVisibility;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  organizationId?: number;
}

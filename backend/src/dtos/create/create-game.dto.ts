import { IsEnum, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { GameVisibility } from '@prisma/client';

export class CreateGameDto {
  @IsOptional()
  @IsEnum(GameVisibility)
  visibility?: GameVisibility;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  organizationId?: number;
}

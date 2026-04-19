import { OrganizationJoinPolicy } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOrganizationInfoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @IsOptional()
  @IsEnum(OrganizationJoinPolicy)
  joinPolicy?: OrganizationJoinPolicy;
}

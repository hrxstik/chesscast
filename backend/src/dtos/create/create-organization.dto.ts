import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrganizationJoinPolicy } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsOptional()
  @IsEnum(OrganizationJoinPolicy)
  joinPolicy?: OrganizationJoinPolicy;
}

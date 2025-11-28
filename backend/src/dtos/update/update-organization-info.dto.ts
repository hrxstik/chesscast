import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOrganizationInfoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;
}

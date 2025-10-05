import { IsEmail, MinLength, MaxLength } from 'class-validator';

export class ConfirmCodeDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  @MaxLength(6)
  code: string;
}

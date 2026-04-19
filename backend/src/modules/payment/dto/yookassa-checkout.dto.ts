import { IsInt, Min } from 'class-validator';

export class YookassaCheckoutDto {
  @IsInt()
  @Min(1)
  planId: number;
}

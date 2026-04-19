import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class YookassaCheckoutDto {
  @IsInt()
  @Min(1)
  planId: number;

  /** Автопродление (сохранение карты в ЮKassa). Если не передано — считается true. */
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

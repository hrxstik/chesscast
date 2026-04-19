import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { PaymentService } from './payment.service';
import { YookassaCheckoutDto } from './dto/yookassa-checkout.dto';

@Controller('payments/yookassa')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(
    @Req() req: Request & { user: { id: number } },
    @Body() body: YookassaCheckoutDto,
  ) {
    return this.paymentService.createYookassaCheckout(
      req.user.id,
      body.planId,
      body.autoRenew,
    );
  }

  /** Уведомления ЮKassa (без JWT); достоверность проверяется повторным GET платежа в API. */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() body: unknown) {
    await this.paymentService.handleYookassaWebhook(body);
    return { ok: true };
  }
}

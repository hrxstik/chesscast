import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerificationCodeRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.verificationCode.create({ data });
  }

  async deleteByUserId(userId: number) {
    return this.prisma.verificationCode.deleteMany({ where: { userId } });
  }

  async findByUserId(userId: number) {
    return this.prisma.verificationCode.findFirst({ where: { userId } });
  }
}

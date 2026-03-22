/**
 * Сидирование демо-пользователей и организации.
 * Запуск: npx prisma db seed   (из каталога backend)
 *
 * Учётки (пароль у всех один для дев-окружения):
 * - superadmin@chesscast.local / ChessCastDev123!
 * - player@chesscast.local     / ChessCastDev123!
 * - schooladmin@chesscast.local/ ChessCastDev123!
 */
import {
  PrismaClient,
  Prisma,
  PlatformRole,
  Role,
  GameMode,
  GameResult,
  GameStatus,
  GameVisibility,
  Color,
  PaymentStatus,
  PaymentPurpose,
  BillingEventType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'ChessCastDev123!';

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const farFuture = new Date('2099-12-31T23:59:59.000Z');

  await prisma.billingEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.userGame.deleteMany();
  await prisma.game.deleteMany();
  await prisma.userOrganization.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'superadmin@chesscast.local',
          'player@chesscast.local',
          'schooladmin@chesscast.local',
        ],
      },
    },
  });

  const superadmin = await prisma.user.create({
    data: {
      name: 'superadmin',
      email: 'superadmin@chesscast.local',
      password: passwordHash,
      platformRole: PlatformRole.SUPERADMIN,
      subscriptionEnd: farFuture,
    },
  });

  const player = await prisma.user.create({
    data: {
      name: 'demo_player',
      email: 'player@chesscast.local',
      password: passwordHash,
      platformRole: PlatformRole.USER,
      subscriptionEnd: farFuture,
    },
  });

  const schoolAdmin = await prisma.user.create({
    data: {
      name: 'school_admin',
      email: 'schooladmin@chesscast.local',
      password: passwordHash,
      platformRole: PlatformRole.USER,
      subscriptionEnd: farFuture,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: 'Демо-школа ChessCast',
      description: 'Сидированная организация для разработки UI и прав админа школы.',
      inviteCode: 'SEED-DEMO-SCHOOL',
    },
  });

  await prisma.userOrganization.create({
    data: {
      userId: schoolAdmin.id,
      organizationId: org.id,
      role: Role.ADMIN,
    },
  });

  await prisma.userOrganization.create({
    data: {
      userId: player.id,
      organizationId: org.id,
      role: Role.PLAYER,
    },
  });

  const game = await prisma.game.create({
    data: {
      mode: GameMode.TRAINING,
      result: GameResult.DRAW,
      status: GameStatus.PENDING,
      token: 'seed-demo-game',
      organizationId: org.id,
      creatorId: player.id,
      visibility: GameVisibility.PRIVATE,
    },
  });

  await prisma.userGame.createMany({
    data: [
      { userId: player.id, gameId: game.id, color: Color.WHITE },
      { userId: schoolAdmin.id, gameId: game.id, color: Color.BLACK },
    ],
  });

  const payment = await prisma.payment.create({
    data: {
      userId: player.id,
      organizationId: org.id,
      amount: new Prisma.Decimal('1490.00'),
      status: PaymentStatus.SUCCEEDED,
      purpose: PaymentPurpose.SUBSCRIPTION_ORG,
      yookassaPaymentId: `seed_${Date.now()}`,
      metadata: { demo: true },
    },
  });

  await prisma.billingEvent.create({
    data: {
      type: BillingEventType.INVOICE_PAID,
      amount: new Prisma.Decimal('1490.00'),
      paymentId: payment.id,
      actorUserId: superadmin.id,
      metadata: { source: 'seed' },
    },
  });

  console.log('Seed OK. Пользователи:');
  console.log(`  SUPERADMIN  ${superadmin.email} / ${DEV_PASSWORD}`);
  console.log(`  Игрок       ${player.email} / ${DEV_PASSWORD}`);
  console.log(`  Админ школы ${schoolAdmin.email} / ${DEV_PASSWORD}`);
  console.log(`  Организация "${org.name}" invite: ${org.inviteCode}`);
  console.log(`  Демо-игра token: ${game.token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

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
  SubscriptionStatus,
  StreamQualityLevel,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'ChessCastDev123!';

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const now = new Date();
  const farFuture = new Date('2099-12-31T23:59:59.000Z');

  await prisma.billingEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.userGame.deleteMany();
  await prisma.game.deleteMany();
  await prisma.userOrganization.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.plan.deleteMany();
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
    },
  });

  const player = await prisma.user.create({
    data: {
      name: 'demo_player',
      email: 'player@chesscast.local',
      password: passwordHash,
      platformRole: PlatformRole.USER,
    },
  });

  const schoolAdmin = await prisma.user.create({
    data: {
      name: 'school_admin',
      email: 'schooladmin@chesscast.local',
      password: passwordHash,
      platformRole: PlatformRole.USER,
    },
  });

  const freePlan = await prisma.plan.create({
    data: {
      code: 'FREE',
      title: 'Базовый',
      description: 'Для начинающих игроков',
      features: ['Личные игры', 'Ограниченные лимиты', 'Без организаций'],
      maxGamesPerPeriod: 30,
      maxOrganizations: 0,
      canCreateOrganization: false,
      canStream: false,
      streamQualityLevel: StreamQualityLevel.LOW,
      priceMonthly: new Prisma.Decimal('0.00'),
    },
  });

  const premiumPlan = await prisma.plan.create({
    data: {
      code: 'PREMIUM',
      title: 'Премиум',
      description: 'Для индивидуальных пользователей и тренеров',
      features: ['Расширенный лимит игр', 'Доступ к стримингу', 'Более высокий приоритет'],
      maxGamesPerPeriod: 300,
      maxOrganizations: 1,
      canCreateOrganization: true,
      canStream: true,
      streamQualityLevel: StreamQualityLevel.MEDIUM,
      priceMonthly: new Prisma.Decimal('299.00'),
    },
  });

  const corporatePlan = await prisma.plan.create({
    data: {
      code: 'CORPORATE',
      title: 'Корпоративная',
      description: 'Для шахматных школ и клубов',
      features: ['Создание организаций', 'Большие лимиты', 'Приоритетная поддержка'],
      maxGamesPerPeriod: 3000,
      maxOrganizations: 3,
      canCreateOrganization: true,
      canStream: true,
      streamQualityLevel: StreamQualityLevel.HIGH,
      priceMonthly: new Prisma.Decimal('2999.00'),
    },
  });

  const playerSubscription = await prisma.subscription.create({
    data: {
      userId: player.id,
      planId: premiumPlan.id,
      status: SubscriptionStatus.ACTIVE,
      startAt: now,
      endAt: farFuture,
      autoRenew: true,
    },
  });

  await prisma.subscription.create({
    data: {
      userId: schoolAdmin.id,
      planId: corporatePlan.id,
      status: SubscriptionStatus.ACTIVE,
      startAt: now,
      endAt: farFuture,
      autoRenew: true,
    },
  });

  await prisma.subscription.create({
    data: {
      userId: superadmin.id,
      planId: freePlan.id,
      status: SubscriptionStatus.ACTIVE,
      startAt: now,
      endAt: farFuture,
      autoRenew: false,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: 'Демо-школа ChessCast',
      description: 'Сидированная организация для разработки UI и прав админа школы.',
      inviteCode: 'SEED-DEMO-SCHOOL',
      ownerUserId: schoolAdmin.id,
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
      subscriptionId: playerSubscription.id,
      planId: premiumPlan.id,
      amount: new Prisma.Decimal('1490.00'),
      status: PaymentStatus.SUCCEEDED,
      purpose: PaymentPurpose.SUBSCRIPTION_PERSONAL,
      providerPaymentId: `seed_${Date.now()}`,
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

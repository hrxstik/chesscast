/**
 * Плотное сидирование демо-данных.
 * Запуск из каталога backend: npx prisma db seed
 *
 * Пароль для всех ниже: ChessCastDev123!
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
  OrganizationJoinPolicy,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

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
      OR: [
        { email: { endsWith: '@seed.chesscast.local' } },
        {
          email: {
            in: [
              'superadmin@chesscast.local',
              'player@chesscast.local',
              'schooladmin@chesscast.local',
            ],
          },
        },
      ],
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

  const extraUsers: { name: string; email: string; role: PlatformRole }[] = [];
  for (let i = 1; i <= 8; i++) {
    extraUsers.push({
      name: `seed_streamer_${i}`,
      email: `seed_streamer_${i}@seed.chesscast.local`,
      role: PlatformRole.USER,
    });
  }
  for (let i = 1; i <= 6; i++) {
    extraUsers.push({
      name: `seed_club_member_${i}`,
      email: `seed_club_member_${i}@seed.chesscast.local`,
      role: PlatformRole.USER,
    });
  }

  const createdExtras: import('@prisma/client').User[] = [];
  for (const u of extraUsers) {
    createdExtras.push(
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: passwordHash,
          platformRole: u.role,
        },
      }),
    );
  }

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

  for (const u of createdExtras.slice(0, 8)) {
    await prisma.subscription.create({
      data: {
        userId: u.id,
        planId: premiumPlan.id,
        status: SubscriptionStatus.ACTIVE,
        startAt: now,
        endAt: farFuture,
        autoRenew: true,
      },
    });
  }
  for (const u of createdExtras.slice(8)) {
    await prisma.subscription.create({
      data: {
        userId: u.id,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        startAt: now,
        endAt: farFuture,
        autoRenew: false,
      },
    });
  }

  const orgInvite = await prisma.organization.create({
    data: {
      name: 'Демо-школа ChessCast',
      description: 'Сидированная организация (только по приглашению).',
      inviteCode: 'SEED-DEMO-SCHOOL',
      joinPolicy: OrganizationJoinPolicy.INVITE_ONLY,
      ownerUserId: schoolAdmin.id,
    },
  });

  const orgOpen = await prisma.organization.create({
    data: {
      name: 'Открытый клуб Seed',
      description: 'Можно вступить без кода (join-open).',
      inviteCode: 'SEED-OPEN-CLUB',
      joinPolicy: OrganizationJoinPolicy.OPEN,
      ownerUserId: schoolAdmin.id,
    },
  });

  await prisma.userOrganization.createMany({
    data: [
      { userId: schoolAdmin.id, organizationId: orgInvite.id, role: Role.ADMIN },
      { userId: player.id, organizationId: orgInvite.id, role: Role.PLAYER },
      { userId: schoolAdmin.id, organizationId: orgOpen.id, role: Role.ADMIN },
      ...createdExtras.slice(8, 14).map((u) => ({
        userId: u.id,
        organizationId: orgOpen.id,
        role: Role.PLAYER as Role,
      })),
    ],
  });

  const game = await prisma.game.create({
    data: {
      mode: GameMode.TRAINING,
      result: GameResult.DRAW,
      status: GameStatus.PENDING,
      token: 'seed-demo-game',
      organizationId: orgInvite.id,
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

  const visibilities = [GameVisibility.PRIVATE, GameVisibility.PUBLIC];
  const modes = [GameMode.TRAINING, GameMode.COMPETITIVE];
  const results = [GameResult.DRAW, GameResult.WHITE_WIN, GameResult.BLACK_WIN];
  const statuses = [GameStatus.PENDING, GameStatus.IN_PROGRESS, GameStatus.FINISHED];

  for (let i = 0; i < 48; i++) {
    const creator = createdExtras[i % createdExtras.length];
    const orgId = i % 3 === 0 ? orgInvite.id : i % 3 === 1 ? orgOpen.id : null;
    const g = await prisma.game.create({
      data: {
        mode: modes[i % modes.length],
        result: results[i % results.length],
        status: statuses[i % statuses.length],
        token: `seed-g-${i}-${randomUUID().slice(0, 8)}`,
        organizationId: orgId,
        creatorId: creator.id,
        visibility: visibilities[i % 2],
      },
    });
    const opponent = createdExtras[(i + 1) % createdExtras.length];
    await prisma.userGame.createMany({
      data: [
        { userId: creator.id, gameId: g.id, color: Color.WHITE },
        { userId: opponent.id, gameId: g.id, color: Color.BLACK },
      ],
    });
  }

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

  console.log('\n========== SEED ChessCast ==========');
  console.log(`Пароль у всех: ${DEV_PASSWORD}\n`);
  console.log('— Основные учётки —');
  console.log(`  SUPERADMIN     ${superadmin.email}`);
  console.log(`  Игрок          ${player.email}`);
  console.log(`  Админ школы    ${schoolAdmin.email}`);
  console.log('\n— Доп. стримеры (PREMIUM) — email / имя');
  for (const u of createdExtras.slice(0, 8)) {
    console.log(`  ${u.email}  |  ${u.name}`);
  }
  console.log('\n— Участники клуба (FREE, часть в открытой орг.) —');
  for (const u of createdExtras.slice(8)) {
    console.log(`  ${u.email}  |  ${u.name}`);
  }
  console.log('\n— Организации —');
  console.log(`  INVITE_ONLY: "${orgInvite.name}" код: ${orgInvite.inviteCode}`);
  console.log(`  OPEN:         "${orgOpen.name}" код (для справки): ${orgOpen.inviteCode}`);
  console.log(`\nДемо-игра token: ${game.token}`);
  console.log('====================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

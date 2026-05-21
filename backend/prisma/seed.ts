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
      features: [
        'Расширенный лимит игр',
        'Доступ к стримингу',
        'Более высокий приоритет',
      ],
      maxGamesPerPeriod: 300,
      maxOrganizations: 5,
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
      features: [
        'Создание организаций',
        'Большие лимиты',
        'Приоритетная поддержка',
      ],
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

  const orgDefs: {
    name: string;
    description: string;
    inviteCode: string;
    joinPolicy: OrganizationJoinPolicy;
  }[] = [
    {
      name: 'Демо-школа ChessCast',
      description: 'Закрытая школа, вступление по коду SEED-DEMO-SCHOOL.',
      inviteCode: 'SEED-DEMO-SCHOOL',
      joinPolicy: OrganizationJoinPolicy.INVITE_ONLY,
    },
    {
      name: 'Открытый клуб Seed',
      description: 'Публичный клуб, можно вступить без кода.',
      inviteCode: 'SEED-OPEN-CLUB',
      joinPolicy: OrganizationJoinPolicy.OPEN,
    },
    {
      name: 'Chess Club Moscow',
      description: 'Клуб для поиска по названию и ID.',
      inviteCode: 'SEED-MOSCOW-CC',
      joinPolicy: OrganizationJoinPolicy.INVITE_ONLY,
    },
    {
      name: 'Юношеская лига Seed',
      description: 'Турнирная лига для демо-фильтров.',
      inviteCode: 'SEED-YOUTH-LIGA',
      joinPolicy: OrganizationJoinPolicy.INVITE_ONLY,
    },
    {
      name: 'Школа тактики Elite',
      description: 'Премиум-клуб с отдельным кодом приглашения.',
      inviteCode: 'SEED-ELITE-TACT',
      joinPolicy: OrganizationJoinPolicy.INVITE_ONLY,
    },
    {
      name: 'Онлайн-академия 64',
      description: 'Ещё одна организация для списка и поиска.',
      inviteCode: 'SEED-ACADEMY-64',
      joinPolicy: OrganizationJoinPolicy.OPEN,
    },
  ];

  const orgs: Awaited<ReturnType<typeof prisma.organization.create>>[] = [];
  for (const def of orgDefs) {
    orgs.push(
      await prisma.organization.create({
        data: {
          ...def,
          ownerUserId: schoolAdmin.id,
        },
      }),
    );
  }
  const [orgInvite, orgOpen, orgMoscow, orgYouth, orgElite, orgAcademy] = orgs;

  /** В каждой организации ровно один ADMIN (владелец школы); остальные — PLAYER. */
  const membershipKey = (userId: number, organizationId: number) =>
    `${userId}:${organizationId}`;
  const seenMemberships = new Set<string>();
  const orgMemberships: {
    userId: number;
    organizationId: number;
    role: Role;
  }[] = [];
  const pushMembership = (
    userId: number,
    organizationId: number,
    role: Role,
  ) => {
    const key = membershipKey(userId, organizationId);
    if (seenMemberships.has(key)) return;
    seenMemberships.add(key);
    orgMemberships.push({ userId, organizationId, role });
  };

  const baseMemberships: {
    userId: number;
    organizationId: number;
    role: Role;
  }[] = [
    { userId: schoolAdmin.id, organizationId: orgInvite.id, role: Role.ADMIN },
    { userId: schoolAdmin.id, organizationId: orgOpen.id, role: Role.ADMIN },
    { userId: schoolAdmin.id, organizationId: orgMoscow.id, role: Role.ADMIN },
    { userId: schoolAdmin.id, organizationId: orgYouth.id, role: Role.ADMIN },
    { userId: schoolAdmin.id, organizationId: orgElite.id, role: Role.ADMIN },
    { userId: schoolAdmin.id, organizationId: orgAcademy.id, role: Role.ADMIN },
    { userId: player.id, organizationId: orgInvite.id, role: Role.PLAYER },
    { userId: player.id, organizationId: orgOpen.id, role: Role.PLAYER },
    { userId: player.id, organizationId: orgMoscow.id, role: Role.PLAYER },
    { userId: player.id, organizationId: orgYouth.id, role: Role.PLAYER },
    { userId: player.id, organizationId: orgElite.id, role: Role.PLAYER },
  ];
  for (const m of baseMemberships) {
    pushMembership(m.userId, m.organizationId, m.role);
  }

  const streamers = createdExtras.slice(0, 8);
  const clubMembers = createdExtras.slice(8);
  const orgIds = [orgInvite.id, orgOpen.id, orgMoscow.id, orgYouth.id, orgElite.id, orgAcademy.id];

  streamers.forEach((u, i) => {
    pushMembership(u.id, orgIds[i % orgIds.length], Role.PLAYER);
    pushMembership(u.id, orgIds[(i + 2) % orgIds.length], Role.PLAYER);
    pushMembership(u.id, orgIds[(i + 4) % orgIds.length], Role.PLAYER);
  });

  clubMembers.forEach((u, i) => {
    pushMembership(u.id, orgOpen.id, Role.PLAYER);
    pushMembership(u.id, orgIds[(i + 3) % orgIds.length], Role.PLAYER);
    pushMembership(u.id, orgAcademy.id, Role.PLAYER);
  });

  await prisma.userOrganization.createMany({ data: orgMemberships });

  const game = await prisma.game.create({
    data: {
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
  const results = [
    GameResult.DRAW,
    GameResult.WHITE_WIN,
    GameResult.BLACK_WIN,
    GameResult.WHITE_RESIGN,
    GameResult.BLACK_RESIGN,
    GameResult.CANCELLED,
  ];
  const statuses = [
    GameStatus.PENDING,
    GameStatus.IN_PROGRESS,
    GameStatus.FINISHED,
  ];
  const orgPool = [orgInvite.id, orgOpen.id, orgMoscow.id, orgYouth.id, null];

  const DEMO_MOVES = [
    'e4',
    'e5',
    'Nf3',
    'Nc6',
    'Bb5',
    'a6',
    'Ba4',
    'Nf6',
    'O-O',
    'Be7',
    'Re1',
    'b5',
    'Bb3',
    'd6',
    'c3',
    'O-O',
    'h3',
    'Nb8',
    'd4',
    'Nbd7',
    'c4',
    'c6',
    'cxb5',
    'axb5',
    'Nc3',
    'Bb7',
    'Bg5',
    'h6',
    'Bh4',
    'c5',
    'dxc5',
    'bxc5',
    'Qd2',
    'Nh5',
    'Rad1',
    'Qc7',
    'Nc3',
    'Ng4',
  ];

  const FINISHED_RESULTS = [
    GameResult.WHITE_WIN,
    GameResult.BLACK_WIN,
    GameResult.DRAW,
    GameResult.STALEMATE,
    GameResult.WHITE_RESIGN,
    GameResult.BLACK_RESIGN,
  ];

  async function seedGameForUser(
    creatorId: number,
    opponentId: number,
    i: number,
    prefix: string,
    creatorOverride?: number,
  ) {
    const dayOffset = i % 90;
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - dayOffset);
    const status = statuses[i % statuses.length];
    const moveCount =
      status === GameStatus.FINISHED
        ? Math.min(DEMO_MOVES.length, 12 + (i % 18))
        : 0;
    const moves = moveCount > 0 ? DEMO_MOVES.slice(0, moveCount) : [];
    const result =
      status === GameStatus.FINISHED
        ? FINISHED_RESULTS[i % FINISHED_RESULTS.length]
        : results[i % results.length];

    const g = await prisma.game.create({
      data: {
        result,
        status,
        moves,
        token: `${prefix}-${i}-${String(i % 10).padStart(2, '0')}-${randomUUID().slice(0, 6)}`,
        organizationId: orgPool[i % orgPool.length],
        creatorId: creatorOverride ?? creatorId,
        visibility: visibilities[i % 2],
        createdAt,
      },
    });
    await prisma.userGame.createMany({
      data: [
        { userId: creatorId, gameId: g.id, color: Color.WHITE },
        { userId: opponentId, gameId: g.id, color: Color.BLACK },
      ],
    });
    return g;
  }

  for (let i = 0; i < 40; i++) {
    const creator = createdExtras[i % createdExtras.length];
    const opponent = createdExtras[(i + 3) % createdExtras.length];
    await seedGameForUser(creator.id, opponent.id, i, 'seed-extra');
  }

  for (let i = 0; i < 55; i++) {
    const opponent = createdExtras[i % createdExtras.length];
    await seedGameForUser(
      player.id,
      opponent.id,
      i + 100,
      'player-filter',
      player.id,
    );
  }

  const playerSpotlight = await seedGameForUser(
    player.id,
    schoolAdmin.id,
    0,
    'filter-demo',
    player.id,
  );
  await prisma.game.update({
    where: { id: playerSpotlight.id },
    data: {
      status: GameStatus.IN_PROGRESS,
      result: GameResult.CANCELLED,
      token: 'filter-demo-live',
      moves: [],
    },
  });

  const analyzeDemo = await prisma.game.create({
    data: {
      result: GameResult.WHITE_WIN,
      status: GameStatus.FINISHED,
      moves: DEMO_MOVES.slice(0, 24),
      token: 'filter-demo-analyze',
      organizationId: null,
      creatorId: player.id,
      visibility: GameVisibility.PRIVATE,
    },
  });
  await prisma.userGame.createMany({
    data: [
      { userId: player.id, gameId: analyzeDemo.id, color: Color.WHITE },
      { userId: schoolAdmin.id, gameId: analyzeDemo.id, color: Color.BLACK },
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
  console.log('\n— Организации (ADMIN: schooladmin@chesscast.local) —');
  for (const o of orgs) {
    console.log(
      `  [${o.joinPolicy}] ${o.name} | код: ${o.inviteCode} | id: ${o.id}`,
    );
  }
  console.log('\n— Публичный профиль —');
  console.log(`  /player/${player.id}  (demo_player)`);
  console.log(`  /player/${schoolAdmin.id}  (school_admin)`);
  console.log('\n— Демо для player@chesscast.local —');
  console.log('  Игры: ~55+ в «Мои игры», фильтр по token: filter-demo');
  console.log('  Вступление по коду: SEED-YOUTH-LIGA или SEED-ELITE-TACT');
  console.log('  Поиск: «Moscow», «Elite», id организации из списка выше');
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

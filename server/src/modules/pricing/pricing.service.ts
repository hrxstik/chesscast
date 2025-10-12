// pricing.service.ts
import { Injectable } from '@nestjs/common';
import { Subscription } from '@prisma/client';

export interface Plan {
  title: string;
  price: string;
  description: string;
  features: string[];
  type: Subscription;
}

@Injectable()
export class PricingService {
  private plans: Plan[] = [
    {
      type: Subscription.FREE,
      title: 'Базовый',
      price: '0 ₽',
      description: 'Для начинающих игроков',
      features: [
        'Перед каждой личной партией нужно посмотреть рекламу',
        'Позволяет играть в организациях',
      ],
    },
    {
      type: Subscription.PREMIUM,
      title: 'Премиум',
      price: '299 ₽ / мес',
      description: 'Для профессионалов и тренеров',
      features: [
        '300 личных партий в месяц',
        'Позволяет играть в организациях',
        'Возможность сохранения истории личных игр',
      ],
    },
    {
      type: Subscription.CORPORATE,
      title: 'Корпоративная',
      price: '2999 ₽ / мес',
      description: 'Для организаций и клубов',
      features: [
        'Все премиум функции',
        'Возможность создания организации',
        '3000 партий организации в месяц',
      ],
    },
    {
      type: Subscription.CORPORATE,
      title: 'Корпоративная+',
      price: '4999 ₽ / мес',
      description: 'Для больших организаций и клубов',
      features: [
        'Все корпоративные функции',
        '6000 партий организации в месяц',
      ],
    },
  ];

  getPlans(): Plan[] {
    return this.plans;
  }
}

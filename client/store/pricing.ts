import { create } from 'zustand';

export enum SubscriptionType {
  FREE,
  PREMIUM,
  CORPORATE,
}

interface Plan {
  title: string;
  price: string;
  description: string;
  features: string[];
}

interface PricingStore {
  plans: Plan[];
  setPlans: (Plans: Plan[]) => void;
  subscriptionType: SubscriptionType;
}

export const usePricingStore = create<PricingStore>((set) => ({
  plans: [
    {
      type: SubscriptionType.FREE,
      title: 'Базовый',
      price: '0 ₽',
      description: 'Для начинающих игроков',
      features: [
        'Перед каждой личной партией нужно посмотреть рекламу',
        'Позволяет играть в организациях',
      ],
    },
    {
      type: SubscriptionType.PREMIUM,
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
      type: SubscriptionType.CORPORATE,
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
      type: SubscriptionType.CORPORATE,
      title: 'Корпоративная+',
      price: '4999 ₽ / мес',
      description: 'Для больших организаций и клубов',
      features: ['Все корпоративные функции', '6000 партий организации в месяц'],
    },
  ],
  setPlans: (plans) => set({ plans }),
  subscriptionType: SubscriptionType.FREE,
}));

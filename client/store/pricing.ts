import { create } from 'zustand';

enum SubscriptionType {
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
      features: ['Ограниченное количество партий'],
    },
    {
      type: SubscriptionType.PREMIUM,
      title: 'Премиум',
      price: '499 ₽ / мес',
      description: 'Для продвинутых пользователей',
      features: ['300 партий в месяц'],
    },
    {
      type: SubscriptionType.CORPORATE,
      title: 'Корпоративная',
      price: '1999 ₽ / мес',
      description: 'Для профессионалов и тренеров',
      features: ['Все премиум функции', 'Возможность создания организации', ''],
    },
  ],
  setPlans: (plans) => set({ plans }),
  subscriptionType: SubscriptionType.FREE,
}));

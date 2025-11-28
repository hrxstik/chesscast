import { ApiRoutes } from '../services/routes';

export async function fetchPlans() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_NEST_API_URL}/${ApiRoutes.GET_PRICING}`, {
    next: {
      revalidate: 600,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch plans');
  }
  return res.json();
}

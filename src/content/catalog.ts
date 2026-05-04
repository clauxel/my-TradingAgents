import type { Option, Plan } from '../app-types'

export const annualBillingMultiplier = 0.65
export const modelDiscountMultiplier = 0.5
export const modelDiscountLabel = '50% off'
export const modelDiscountTooltip = 'Choose this model and get 50% off the package price.'

export const planCatalog: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPriceLabel: '$19',
    monthlyAmountCents: 1900,
    currency: 'USD',
    subtitle: 'Best for one desk and a tight watchlist',
    etaMinutes: 12,
    includedDeployments: 1,
    bullets: ['1 hosted TradingAgents desk', 'Single-symbol daily workflow', '1 delivery touchpoint'],
    featured: false,
  },
  {
    id: 'growth',
    name: 'Research',
    monthlyPriceLabel: '$59',
    monthlyAmountCents: 5900,
    currency: 'USD',
    subtitle: 'Best value for recurring research loops',
    etaMinutes: 8,
    includedDeployments: 5,
    bullets: ['5 hosted desks', 'Bull-bear review templates', 'Best for recurring watchlists'],
    featured: true,
  },
  {
    id: 'scale',
    name: 'Desk',
    monthlyPriceLabel: '$149',
    monthlyAmountCents: 14900,
    currency: 'USD',
    subtitle: 'Built for teams operating multiple research lanes',
    etaMinutes: 5,
    includedDeployments: 20,
    bullets: ['20 hosted desks', 'Team handoff and staging lanes', 'Best for portfolio-scale review ops'],
    featured: false,
  },
]

export type FrontendCatalogOption = Omit<Option, 'icon'>

export const modelCatalog: FrontendCatalogOption[] = [
  {
    id: 'gpt-5-4',
    name: 'GPT-5.4',
    status: 'Default',
    highlights: ['Deep research', 'Balanced speed'],
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    status: 'Fast',
    highlights: ['Desk drafts', 'Lower latency'],
  },
  {
    id: 'gemini-3-1-pro',
    name: 'Gemini 3.1 Pro',
    status: 'Broad context',
    highlights: ['Cross-source synthesis', 'High reasoning'],
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    status: 'Premium',
    discountMultiplier: modelDiscountMultiplier,
    discountLabel: modelDiscountLabel,
    discountTooltip: modelDiscountTooltip,
  },
  {
    id: 'glm-4-7',
    name: 'GLM-4.7',
    status: 'Alt provider',
    discountMultiplier: modelDiscountMultiplier,
    discountLabel: modelDiscountLabel,
    discountTooltip: modelDiscountTooltip,
  },
  {
    id: 'glm-5-1',
    name: 'GLM-5.1',
    status: 'Latest GLM',
    discountMultiplier: modelDiscountMultiplier,
    discountLabel: modelDiscountLabel,
    discountTooltip: modelDiscountTooltip,
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    status: 'Budget depth',
    discountMultiplier: modelDiscountMultiplier,
    discountLabel: modelDiscountLabel,
    discountTooltip: modelDiscountTooltip,
  },
  {
    id: 'gpt-4-1',
    name: 'GPT-4.1',
    status: 'Budget OpenAI',
    discountMultiplier: modelDiscountMultiplier,
    discountLabel: modelDiscountLabel,
    discountTooltip: modelDiscountTooltip,
  },
]

export const channelCatalog: FrontendCatalogOption[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    status: 'Alert feed',
    highlights: ['Morning brief'],
  },
  {
    id: 'discord',
    name: 'Discord',
    status: 'Team room',
    highlights: ['Research review'],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    status: 'Mobile handoff',
    highlights: ['Exec summary'],
  },
]

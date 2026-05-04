import { CircleHelp, Layers3, Rocket, ServerCog } from 'lucide-react'

import {
  ClaudeLogo,
  DiscordLogo,
  GlmLogo,
  GeminiLogo,
  OpenAILogo,
  TelegramLogo,
  WhatsAppLogo,
} from '../components/logos'
import { annualBillingMultiplier, channelCatalog, modelCatalog, planCatalog } from './catalog'
import type {
  AuthFormState,
  ComparisonPage,
  CreateUserFormState,
  FaqItem,
  Feature,
  GuideChannel,
  GuideContent,
  LegalSection,
  NavItem,
  Option,
  Plan,
  ResourcePage,
  SolutionPage,
} from '../app-types'

export const supportLinkHref = 'https://github.com/TauricResearch/TradingAgents/issues'
export const supportLinkLabel = 'GitHub Issues'
export const sourceRepositoryHref = 'https://github.com/TauricResearch/TradingAgents'
export const supportEmailHref = 'mailto:support@aigeamy.com'
export const supportEmailLabel = 'support@aigeamy.com'
export const paperHref = 'https://arxiv.org/abs/2412.20138'
export const redditSearchHref = 'https://www.reddit.com/search/?q=TradingAgents'

export const navItems: NavItem[] = [
  { href: '#features', label: 'Workflow', icon: Layers3 },
  { href: '#solutions', label: 'Use Cases', icon: Layers3 },
  { href: '#resources', label: 'Resources', icon: CircleHelp },
  { href: '#pricing', label: 'Pricing', icon: Rocket },
  { href: '/console', label: 'Console', icon: ServerCog },
  { href: '#faq', label: 'FAQ', icon: CircleHelp },
]

export const privacySections: LegalSection[] = [
  {
    title: 'Scope and overview',
    paragraphs: [
      'This Privacy Policy explains how TradingAgents AI handles information when visitors read the site, create accounts, start checkout, provision a hosted desk, connect a delivery touchpoint, open the console, or contact support.',
      'The service is designed as a hosted launch and operations layer for TradingAgents-style research workspaces. Some information must be processed so account access, payment, provisioning, console visibility, and support can function.',
    ],
  },
  {
    title: 'Information we collect',
    paragraphs: [
      'We may collect information you provide directly, information generated through use of the service, and limited technical information required to operate and secure the product.',
    ],
    bullets: [
      'Account information such as name, email address, password hash, account role, and account status.',
      'Order and plan details such as model choice, delivery touchpoint, billing cycle, order identifiers, payment state, deployment state, and timestamps.',
      'Delivery-channel material such as Telegram, Discord, or WhatsApp tokens when you choose to store them for later binding.',
      'Guest access and session data such as cookies, session identifiers, checkout paths, console paths, and account-binding state.',
      'Workspace metadata such as instance names, version references, provisioning logs, console URLs, target server labels, and operational status.',
      'Support communications and issue-tracker messages you voluntarily send to us.',
      'Standard request diagnostics such as browser metadata, timestamps, referrer context, and security logs.',
    ],
  },
  {
    title: 'How we use information',
    paragraphs: ['We use information only as reasonably necessary to operate, secure, improve, support, and enforce the service.'],
    bullets: [
      'To create and administer accounts, guest sessions, orders, and workspace records.',
      'To start checkout sessions, reconcile payment events, and maintain billing records.',
      'To provision, monitor, upgrade, pause, or remove hosted TradingAgents desks.',
      'To store optional delivery tokens for later channel binding or relaunch.',
      'To respond to support requests, operational incidents, billing questions, and abuse reports.',
      'To detect misuse, fraud, unauthorized access, or activity that threatens service integrity.',
      'To comply with legal obligations and vendor requirements.',
    ],
  },
  {
    title: 'Sensitive credentials',
    paragraphs: [
      'The service may receive API-like tokens, guest links, session material, and deployment-related secrets. We try to minimize exposure and use reasonable technical measures to reduce unnecessary plain-text handling.',
      'No transmission, storage, or processing method is perfectly secure. We cannot guarantee absolute security or immunity from compromise.',
    ],
  },
  {
    title: 'Payments and third-party providers',
    paragraphs: [
      'Checkout and payment processing are handled by third-party providers. We do not represent that complete payment-card details are stored by this website.',
      'We may share order identifiers, plan details, customer email, return URLs, and limited transaction metadata with payment providers to create and manage checkout sessions and confirm payment state.',
    ],
  },
  {
    title: 'Disclosures',
    paragraphs: ['We do not sell personal information in the ordinary course of operating this service. We may disclose information only when reasonably necessary in the following situations:'],
    bullets: [
      'To hosting, infrastructure, deployment, payment, security, or technical service providers that help operate the service.',
      'To protect the security, rights, property, systems, or lawful interests of the service, its users, or third parties.',
      'To comply with law, regulation, court order, subpoena, or similar legal process.',
      'In connection with a merger, acquisition, financing, or asset transfer, subject to appropriate confidentiality handling where practicable.',
    ],
  },
  {
    title: 'Retention and controls',
    paragraphs: [
      'We retain information for as long as reasonably necessary for account administration, order history, payment reconciliation, workspace operations, fraud prevention, security review, dispute handling, and legal compliance.',
      'Depending on your location and applicable law, you may have rights to request access, correction, or deletion of certain personal information, subject to lawful exceptions and operational limitations.',
    ],
  },
  {
    title: 'Cookies and sessions',
    paragraphs: [
      'The website uses cookies, guest tokens, session identifiers, and related browser storage to keep login state, guest checkout, guest console access, and binding state working.',
      'If you disable cookies or similar storage behavior, parts of the service may stop working correctly.',
    ],
  },
  {
    title: 'Changes and contact',
    paragraphs: [
      'We may update this Privacy Policy from time to time by posting an updated version on the website.',
      `If you have questions, open an issue at ${supportLinkHref} or email ${supportEmailLabel}.`,
    ],
  },
]

export const termsSections: LegalSection[] = [
  {
    title: 'Acceptance of terms',
    paragraphs: [
      'These Terms of Service govern access to and use of TradingAgents AI, including the website, hosted launch flow, checkout, console, APIs, account features, provisioning tracking, and upgrade functions.',
      'By accessing or using the service, you agree to be bound by these Terms. If you do not agree, do not use the service.',
    ],
  },
  {
    title: 'Nature of the service',
    paragraphs: [
      'TradingAgents AI provides a hosted interface for configuring and operating a TradingAgents-style research workspace. It is a software and operations service, not a broker, exchange, or investment adviser.',
      'Unless expressly stated otherwise, the service is provided on an as-available and as-provided basis. Features, provider coverage, launch flows, and integrations may change over time.',
    ],
  },
  {
    title: 'Eligibility and account responsibility',
    paragraphs: [
      'You represent that you have legal capacity to use the service and that you are authorized to act on behalf of any entity you represent.',
      'You are responsible for maintaining the confidentiality of your account credentials, guest links, console links, and any third-party delivery credentials you choose to submit.',
    ],
  },
  {
    title: 'Orders, checkout, and provisioning',
    paragraphs: [
      'Creating an order or selecting a plan does not guarantee payment approval, successful provisioning, uninterrupted console access, or future service availability.',
      'Provisioning outcomes may depend on infrastructure state, repository availability, payment confirmation, server configuration, third-party APIs, firewall behavior, and other factors outside our direct control.',
      'Displayed timing estimates, plan labels, and package descriptions are informational unless we expressly agree otherwise in writing.',
    ],
  },
  {
    title: 'Financial-use disclaimer',
    paragraphs: [
      'The service is offered for research, analysis, prototyping, and workflow operations. It is not financial, investment, legal, tax, or trading advice.',
      'You remain solely responsible for any live trading, portfolio action, compliance review, or reliance decision made from outputs generated through the service.',
    ],
  },
  {
    title: 'Acceptable use',
    paragraphs: ['You may not use the service in a way that is unlawful, fraudulent, abusive, infringing, or harmful to systems, networks, or other users.'],
    bullets: [
      'Attempting to bypass authentication, payment controls, provisioning safeguards, or access restrictions.',
      'Submitting credentials or data you are not authorized to use.',
      'Using the service to distribute deceptive, unlawful, or malicious content through any delivery channel.',
      'Overloading or interfering with the site, payment flow, console, API endpoints, or deployment systems.',
      'Scraping or automating the service in an abusive manner that is not reasonably permitted by us.',
    ],
  },
  {
    title: 'Third-party services',
    paragraphs: [
      'The service depends on third-party providers such as payment platforms, model providers, software repositories, messaging platforms, and hosting vendors. We do not control those services and are not responsible for their availability, policy changes, or risk decisions.',
      'Use of any third-party provider may also be subject to that provider\'s own terms and operational restrictions.',
    ],
  },
  {
    title: 'Intellectual property',
    paragraphs: [
      'As between you and us, we retain rights in the website, service design, UI, hosted operations layer, and related materials, except where rights are granted by law or written agreement.',
      'The upstream TradingAgents open-source project remains subject to its own license and repository terms.',
    ],
  },
  {
    title: 'Disclaimers and limitation of liability',
    paragraphs: [
      'To the maximum extent permitted by law, the service is provided as is, as available, and with all faults, without warranties of any kind.',
      'To the maximum extent permitted by law, we will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of revenue, profit, business, goodwill, opportunity, or data arising out of or related to the service.',
    ],
  },
  {
    title: 'Changes and contact',
    paragraphs: [
      'We may revise these Terms from time to time by posting an updated version on the site. Continued use after an updated version becomes effective constitutes acceptance of the revised Terms.',
      `Questions can be sent to ${supportEmailLabel} or raised through ${supportLinkHref}.`,
    ],
  },
]

export const models: Option[] = modelCatalog.map((model) => ({
  ...model,
  icon:
    model.id.startsWith('glm')
      ? <GlmLogo />
      : model.id.startsWith('claude')
        ? <ClaudeLogo />
        : model.id.startsWith('gpt')
          ? <OpenAILogo />
          : <GeminiLogo />,
}))

export const channels: Option[] = channelCatalog.map((channel) => ({
  ...channel,
  icon:
    channel.id === 'telegram'
      ? <TelegramLogo />
      : channel.id === 'discord'
        ? <DiscordLogo />
        : <WhatsAppLogo />,
}))

export const channelBadges = ['Market data', 'Debate', 'Risk', 'Portfolio', 'Logs', 'Exports']

export const features: Feature[] = [
  {
    title: 'Specialist analysts before synthesis',
    description: (
      <>
        Keep <strong>fundamental, sentiment, news, and technical analysis</strong> in distinct lanes so the workflow
        behaves more like a desk with coverage roles than a single oversized prompt.
      </>
    ),
  },
  {
    title: 'Bull and bear researchers in the same run',
    description: (
      <>
        Force structured disagreement before action. The desk keeps a <strong>bull case and a bear case side by
        side</strong> so the strongest argument has to survive review.
      </>
    ),
  },
  {
    title: 'Trader, risk manager, and portfolio manager',
    description: (
      <>
        The final output does not stop at a thesis. It flows through <strong>trader, risk-manager, and
        portfolio-manager stages</strong> so sizing pressure, approval, and rejection remain legible.
      </>
    ),
  },
  {
    title: 'Model choice without changing the workflow',
    description: (
      <>
        Swap among <strong>GPT, Claude, Gemini, and GLM options</strong> in the hosted desk while keeping the same
        research structure, comparison frame, and downstream delivery path.
      </>
    ),
  },
  {
    title: 'Checkpoint-ready, repeatable research ops',
    description: (
      <>
        The current upstream project highlights <strong>checkpoint resume and persistent decision logs</strong>, while
        the hosted layer saves the desk setup and operating path for cleaner reruns over time.
      </>
    ),
  },
  {
    title: 'CLI, Docker, or hosted launch',
    description:
      'Use the CLI or Docker path when full self-hosting is the goal, or start with plans, checkout, provisioning, and console access already wired when the goal is to operate the workflow sooner.',
  },
]

export const plans: Plan[] = planCatalog

export const faqs: FaqItem[] = [
  {
    question: 'Is this the open-source TradingAgents repository itself?',
    answer:
      'No. The repository remains the source project on GitHub. This site is a hosted launch and operations surface built around that workflow so teams can get to a usable desk faster.',
  },
  {
    question: 'What does a run actually produce?',
    answer:
      'A typical run produces analyst notes, a bull-vs-bear research pass, a trader recommendation, a risk review, and a final portfolio-facing decision summary for the chosen ticker and date.',
  },
  {
    question: 'Can I bring my own model or provider?',
    answer:
      'Yes. The workflow is designed around provider choice. Teams can choose the model family that fits their preferred cost, speed, and reasoning profile.',
  },
  {
    question: 'Is this for live trading?',
    answer:
      'Treat it as a research and decision-support system. It is useful for paper trading, watchlists, and investment research loops, but it is not financial advice and should not replace human review or compliance checks.',
  },
  {
    question: 'Why not just self-host with Docker?',
    answer:
      'Self-hosting is a strong option when you want full infrastructure ownership. The hosted path is for teams that want faster launch, cleaner checkout, and a console for repeat operation without turning setup into a separate engineering task.',
  },
  {
    question: 'How do Telegram, Discord, and WhatsApp fit in?',
    answer:
      'They work as delivery touchpoints for research summaries, alerts, and handoff messages. The core reasoning still happens inside the hosted TradingAgents desk.',
  },
]

export const solutionPages: SolutionPage[] = [
  {
    href: '/solutions/equity-research-desk',
    label: 'Research Desk',
    eyebrow: 'Use Cases',
    title: 'Use TradingAgents AI as a multi-agent equity research desk',
    summary:
      'Turn a single ticker into a structured desk workflow with analyst roles, debate, risk review, and a final investment memo that is easier to compare across dates.',
    definition:
      'This path is for teams that want the open-source TradingAgents workflow in a simpler hosted format. Instead of stitching models, prompts, and delivery together manually, the desk organizes the run around the same role-based research flow.',
    facts: [
      'Fundamental, sentiment, news, and technical analysis all appear before the trade recommendation.',
      'Bull and bear researchers challenge the case before the final call.',
      'Risk review remains visible instead of hidden inside one long model response.',
      'The hosted desk makes repeat runs easier to compare across symbols and dates.',
    ],
    bestFor: [
      'Analysts building repeatable single-ticker research briefs',
      'Investors who want a clean pre-trade review workflow',
      'Teams turning watchlist names into comparable memos each day or week',
    ],
    notFor: [
      'Users looking for guaranteed live-trading signals',
      'Teams that only want one-off chat answers with no saved operating flow',
      'Use cases where no human review will happen before action',
    ],
    outcomes: ['Cleaner analyst separation', 'More legible risk discussion', 'More repeatable ticker-by-ticker research'],
    workflow: [
      'Choose the model, ticker, date, and delivery touchpoint on the homepage',
      'Launch the hosted desk and complete checkout',
      'Run recurring research cycles and review the desk outputs from the console',
    ],
    conclusion:
      'Choose this path when the problem is not generating one opinion, but running a consistent research process that stays readable over time.',
    faqs: [
      {
        question: 'Why is the multi-agent split useful for equity research?',
        answer:
          'Because it separates evidence types. Fundamentals, sentiment, news, technicals, and risk often disagree, and that disagreement is exactly what a serious desk needs to see.',
      },
      {
        question: 'Can I compare the same ticker across multiple dates?',
        answer:
          'Yes. That is one of the most useful patterns for the hosted desk because it turns each run into a time-stamped research checkpoint instead of another isolated answer.',
      },
      {
        question: 'Does this replace human judgment?',
        answer:
          'No. It improves the structure and speed of the research process, but final investment decisions still need human review.',
      },
    ],
  },
  {
    href: '/solutions/paper-trading-lab',
    label: 'Paper Trading',
    eyebrow: 'Use Cases',
    title: 'Use TradingAgents AI for paper trading and scenario testing',
    summary:
      'Run the debate, trade thesis, and risk review before you put real capital behind an idea, then keep the outputs organized enough to learn from them later.',
    definition:
      'Paper trading is one of the best ways to use a multi-agent trading workflow because it exposes the reasoning path without forcing immediate live execution. The hosted desk helps teams test consistency, not just excitement.',
    facts: [
      'The workflow produces a readable chain from analyst evidence to proposed action.',
      'Risk review can reject or soften an aggressive trade thesis.',
      'Saved run settings reduce setup friction for repeated watchlist checks.',
      'The console becomes a better place to review process quality than a pile of screenshots.',
    ],
    bestFor: [
      'Founders or researchers testing whether the workflow fits their market process',
      'Investors who want structured paper-trading experiments before live deployment',
      'Teams comparing model families on the same prompt and market setup',
    ],
    notFor: [
      'Anyone expecting automated guaranteed-profit execution',
      'Traders who do not intend to review risk and assumptions manually',
      'Teams that need regulated execution tooling rather than research infrastructure',
    ],
    outcomes: ['Safer experimentation', 'Clearer comparisons between model stacks', 'Better post-run review habits'],
    workflow: [
      'Select a watchlist name, analysis date, and preferred model depth',
      'Send outputs to a private channel or keep review inside the console',
      'Track patterns in the desk output before deciding whether any workflow deserves live capital',
    ],
    conclusion:
      'This is the strongest entry path when you want to evaluate process quality first and treat performance claims with appropriate skepticism.',
    faqs: [
      {
        question: 'Why is paper trading a better first step than live automation?',
        answer:
          'Because it gives you a safer way to test assumptions, model choice, and reasoning consistency before adding market risk.',
      },
      {
        question: 'What should I review after each run?',
        answer:
          'Look at which analyst views drove the decision, whether risk review changed the outcome, and whether the final action would still make sense after a calm reread.',
      },
      {
        question: 'Can this help compare providers like GPT, Claude, or Gemini?',
        answer:
          'Yes. The same workflow can be rerun with different models, which makes paper trading a practical evaluation surface for provider choice.',
      },
    ],
  },
  {
    href: '/solutions/risk-review-workflows',
    label: 'Risk Review',
    eyebrow: 'Use Cases',
    title: 'Use TradingAgents AI to make risk review part of the workflow, not an afterthought',
    summary:
      'Bring risk management and portfolio review into the same loop as analysis so proposed trades are easier to challenge before anyone acts on them.',
    definition:
      'Many AI trading demos stop at conviction. TradingAgents is more useful when the output still has to face a risk layer. This hosted workflow keeps that stage visible to the team reviewing the result.',
    facts: [
      'The portfolio manager layer helps turn ideas into approve, reject, or resize decisions.',
      'Risk discussion is easier to share internally when it is already embedded in the workflow.',
      'A hosted desk is easier to operate for recurring review than a loose notebook plus screenshots.',
      'Delivery channels make it practical to drop summaries into existing review rooms.',
    ],
    bestFor: [
      'Teams that want a visible challenge step before action',
      'Portfolio reviewers comparing multiple candidate trades',
      'Research groups that need cleaner internal handoff between analysis and decision',
    ],
    notFor: [
      'Use cases where speed matters more than legibility or governance',
      'Users who only want a bullish thesis generator',
      'Workflows with no reviewer on the other side of the output',
    ],
    outcomes: ['More disciplined trade review', 'Better team handoff', 'Less hidden risk in final recommendations'],
    workflow: [
      'Use the homepage to prepare the desk settings and preferred delivery path',
      'Launch a plan that fits how often your team reruns the workflow',
      'Review the trader and risk-manager outputs together before any downstream action',
    ],
    conclusion:
      'When a team needs research that can survive review, the risk-first interpretation of TradingAgents is usually more valuable than the most confident raw signal.',
    faqs: [
      {
        question: 'Does this make the workflow slower?',
        answer:
          'A little, but in a good way. The point is to spend time where bad decisions usually hide: assumptions, sizing, and unchallenged conviction.',
      },
      {
        question: 'Who should receive the summary first?',
        answer:
          'Usually the reviewer or private team room where trades are challenged, not the widest possible audience.',
      },
      {
        question: 'What is the practical benefit of the portfolio-manager step?',
        answer:
          'It forces the final output to become an approve, reject, or resize decision instead of staying a vague opinion.',
      },
    ],
  },
]

export const comparisonPages: ComparisonPage[] = [
  {
    href: '/compare/tradingagents-vs-single-llm',
    label: 'Single LLM',
    eyebrow: 'Compare',
    title: 'TradingAgents AI vs a single-LLM trading prompt',
    summary:
      'Choose the TradingAgents workflow when you want analyst separation, visible disagreement, and risk-aware conclusions. Choose a single prompt when speed matters more than process clarity.',
    alternativeName: 'Single-LLM prompt',
    chooseLaunch: [
      'You want separate analyst roles rather than one blended answer',
      'You care about bull-vs-bear disagreement before the final call',
      'You need a visible risk layer that can challenge the recommendation',
    ],
    chooseAlternative: [
      'You only need a fast directional thought starter',
      'You do not care about preserving the internal reasoning structure',
      'You are exploring ideas casually rather than building a repeatable desk process',
    ],
    rows: [
      {
        label: 'Reasoning structure',
        launch: 'Role-based analysts, debate, trader synthesis, and risk review all stay explicit',
        alternative: 'Everything is compressed into one response, which is faster but less inspectable',
      },
      {
        label: 'Disagreement handling',
        launch: 'Bull and bear positions are part of the workflow',
        alternative: 'Conflicting evidence is often flattened into one final paragraph',
      },
      {
        label: 'Team review',
        launch: 'Outputs are easier to pass around because stages stay visible',
        alternative: 'The answer is usually less structured for internal challenge or approval',
      },
      {
        label: 'Repeatability',
        launch: 'The desk setup is easier to rerun across dates, models, and symbols',
        alternative: 'Results depend more heavily on manual prompt consistency',
      },
    ],
    faqs: [
      {
        question: 'Is a single prompt ever enough?',
        answer:
          'Yes. It is enough when you only need a quick idea or directional summary. The TradingAgents workflow becomes more valuable when you need a process, not just a sentence.',
      },
      {
        question: 'Does multi-agent always outperform?',
        answer:
          'No workflow wins in every market condition. The advantage here is usually better structure and reviewability, not magical certainty.',
      },
      {
        question: 'What is the biggest practical difference?',
        answer:
          'You can see why the final recommendation happened and where the disagreement lived, which makes follow-up decisions more disciplined.',
      },
    ],
  },
  {
    href: '/compare/tradingagents-vs-manual-research',
    label: 'Manual Research',
    eyebrow: 'Compare',
    title: 'TradingAgents AI vs fully manual trading research',
    summary:
      'Choose the hosted TradingAgents desk when repeatable structure, speed, and side-by-side runs matter. Stay manual when judgment depends on bespoke context that you do not want abstracted yet.',
    alternativeName: 'Fully manual research',
    chooseLaunch: [
      'You review the same style of market question repeatedly',
      'You want faster first drafts without losing role separation',
      'You need cleaner handoff into a team channel or review room',
    ],
    chooseAlternative: [
      'Your process is too custom to standardize yet',
      'You rely on inputs that must stay entirely outside a hosted workflow',
      'You do not want any model-generated synthesis in the loop',
    ],
    rows: [
      {
        label: 'Speed to first draft',
        launch: 'The desk organizes the first pass quickly once the setup is saved',
        alternative: 'Manual research takes longer but may capture highly bespoke context',
      },
      {
        label: 'Consistency',
        launch: 'Runs are easier to compare because the workflow repeats cleanly',
        alternative: 'Manual notes vary more by day, analyst, and time pressure',
      },
      {
        label: 'Knowledge transfer',
        launch: 'Team handoff improves through shared summaries and delivery channels',
        alternative: 'Manual processes often stay trapped in one person\'s notebook or screenshots',
      },
      {
        label: 'Control',
        launch: 'You still choose providers, symbols, dates, and review boundaries',
        alternative: 'Manual research gives maximum flexibility at the cost of more repetition',
      },
    ],
    faqs: [
      {
        question: 'Should serious teams avoid automation entirely?',
        answer:
          'Not necessarily. The better question is which part of the process deserves automation and which part should remain human judgment. TradingAgents is strongest in the middle: structure, synthesis, and repeatability.',
      },
      {
        question: 'What should remain manual?',
        answer:
          'Capital allocation, compliance, portfolio-level constraints, and any decision with material business or legal consequences should still be explicitly reviewed by humans.',
      },
      {
        question: 'What is the best first use case?',
        answer:
          'A repeatable watchlist or single-ticker review loop is usually the cleanest place to start because it exposes whether the workflow genuinely saves time.',
      },
    ],
  },
]

export const resourcePages: ResourcePage[] = [
  {
    href: '/resources/tradingagents-github',
    label: 'TradingAgents GitHub',
    eyebrow: 'Resource',
    title: 'TradingAgents GitHub guide: what to inspect before you launch or fork',
    summary:
      'A practical guide to the TradingAgents GitHub repository, including the folders, release notes, model support, and evaluation questions that matter more than star counts.',
    definition:
      'The GitHub repository is the best first source for understanding what TradingAgents really is. A good review goes beyond the README headline and checks the release cadence, CLI flow, provider support, Docker path, and how the project structures analysts, debate, and risk review.',
    primaryAction: {
      label: 'Open TradingAgents on GitHub',
      href: sourceRepositoryHref,
      external: true,
    },
    sections: [
      {
        title: 'Start with the repository shape',
        body:
          'Look at the README, release notes, Docker files, CLI entry points, and the `tradingagents` package itself. You want to understand whether the project is organized like a real framework or just a one-off demo.',
        bullets: [
          'Check the News or changelog section to see how actively model support and platform fixes are maintained.',
          'Inspect installation, `.env`, and provider configuration details before you commit to a fork.',
          'Look for where analyst roles, debate flow, risk review, and memory or logging are actually implemented.',
        ],
      },
      {
        title: 'Read releases like an operator',
        body:
          'Recent releases matter because provider support changes quickly. The current project history highlights Docker support, broader provider coverage, checkpoint resume, and structured-output agents, which are all relevant signals for hosted use.',
      },
      {
        title: 'Decide whether to fork or launch',
        body:
          'Fork the repository when deep code ownership is the goal. Use a hosted launch when the real bottleneck is getting a clean desk, checkout, provisioning, and repeat operation path in place first.',
      },
    ],
    checklist: [
      'Can you explain the role split without rereading the README three times?',
      'Do the release notes show active maintenance around providers and runtime stability?',
      'Is Docker or local install documented clearly enough for your team?',
      'Do you want code ownership immediately, or a usable desk sooner?',
    ],
    conclusion:
      'Use GitHub to understand the framework, then decide whether you want to self-host, fork, or use a simpler hosted desk on top of that operating model.',
    faqs: [
      {
        question: 'What is the most important thing to verify in the repo?',
        answer:
          'That the workflow stages are real and inspectable. The value is not just “AI for trading,” but how the framework separates analysts, debate, and risk.',
      },
      {
        question: 'Do stars tell me enough?',
        answer:
          'No. Stars show attention, not operational fit. Release quality, setup clarity, provider support, and code structure are more useful signals.',
      },
      {
        question: 'Should I read the issues too?',
        answer:
          'Yes. Issues often reveal setup friction, provider edge cases, and what users struggle with after the marketing layer ends.',
      },
    ],
  },
  {
    href: '/resources/tradingagents-cn',
    label: 'TradingAgents-CN',
    eyebrow: 'Resource',
    title: 'TradingAgents-CN guide for Chinese-speaking teams and bilingual operators',
    summary:
      'A useful overview of how Chinese-speaking teams can approach TradingAgents, including multi-language support, China-relevant model providers, and Windows/encoding concerns worth checking first.',
    definition:
      'TradingAgents-CN is not just about translation. For many teams it means verifying whether the framework works comfortably with bilingual research notes, region-relevant model providers, and the practical setup details that matter in Chinese-speaking environments.',
    sections: [
      {
        title: 'What makes the CN angle useful',
        body:
          'The project now highlights multi-language support, and the provider list includes options such as GLM and Qwen through standard configuration paths. That matters for teams who want the workflow without being locked into one model ecosystem.',
        bullets: [
          'Check whether your preferred providers, proxies, and API endpoints match the way your team already works.',
          'Validate UTF-8 and terminal handling early if you expect bilingual filenames or notes.',
          'Keep the public site in English if that is your acquisition strategy, while using bilingual internal workflows where helpful.',
        ],
      },
      {
        title: 'Where teams usually get stuck',
        body:
          'The common problems are less about the idea and more about environment details: API keys, Docker expectations, model availability, and reproducible local setup. Treat those as part of the evaluation, not as an afterthought.',
      },
      {
        title: 'When a hosted desk helps',
        body:
          'A hosted layer is especially useful for bilingual teams that want a clean UI and repeatable operations without spending the first phase rebuilding surrounding infrastructure.',
      },
    ],
    checklist: [
      'Does your team need OpenAI-only support, or broader provider flexibility?',
      'Will you run bilingual notes, prompts, or exports in daily use?',
      'Have you tested encoding and environment setup on your target machines?',
      'Would a hosted workflow remove enough setup drag to justify it?',
    ],
    conclusion:
      'The CN use case is really about practical adoption: language, providers, environment friction, and how quickly a team can move from curiosity to repeatable use.',
    faqs: [
      {
        question: 'Does TradingAgents support Chinese workflows directly?',
        answer:
          'It is better to think in terms of multi-language support plus compatible providers, rather than expecting one separate “Chinese edition” to solve every environment detail automatically.',
      },
      {
        question: 'Which providers matter most for Chinese teams?',
        answer:
          'That depends on your environment, but GLM and Qwen support are especially relevant when teams want alternatives to a single-provider stack.',
      },
      {
        question: 'Is this page only for teams in China?',
        answer:
          'No. It is also useful for bilingual teams anywhere that want Chinese-language research notes or China-relevant model coverage.',
      },
    ],
  },
  {
    href: '/resources/tradingagents-ai',
    label: 'TradingAgents AI',
    eyebrow: 'Resource',
    title: 'What TradingAgents AI actually means in practice',
    summary:
      'A plain-English explanation of the TradingAgents AI concept: a hosted multi-agent market research desk rather than a mysterious black-box trading bot.',
    definition:
      'People often search for “TradingAgents AI” expecting either a magic trading engine or a generic LLM wrapper. The more useful interpretation is a role-based research workflow that turns one market question into staged analysis, debate, risk review, and a final decision memo.',
    sections: [
      {
        title: 'Think of it as a desk, not a signal vending machine',
        body:
          'The practical value is in structure. Analyst roles separate evidence, debate forces challenge, and the risk layer keeps the recommendation closer to something a real team could review.',
      },
      {
        title: 'Why the hosted version is easier to use',
        body:
          'A hosted layer turns a source project into a product experience: choose a model, set a delivery path, launch a desk, and keep operations inside a console instead of a loose pile of scripts and ad hoc notes.',
      },
      {
        title: 'What it does not do',
        body:
          'It does not remove uncertainty, guarantee returns, or replace portfolio accountability. The point is better research process, not magical certainty.',
      },
    ],
    checklist: [
      'Can you describe the role split from analysts to portfolio manager?',
      'Do you want a repeatable workflow or just one answer?',
      'Are you evaluating research quality, provider quality, or both?',
      'Do you need a hosted desk more than a raw repo clone?',
    ],
    conclusion:
      'TradingAgents AI is most useful when you treat it as research infrastructure: a system for structuring evidence and review, not a shortcut around market uncertainty.',
    faqs: [
      {
        question: 'Why use the word “AI” if the value is workflow?',
        answer:
          'Because the models still matter, but the workflow is what turns model output into something a team can actually review and reuse.',
      },
      {
        question: 'Is this mainly for individual traders or teams?',
        answer:
          'It can help both, but it becomes more compelling when multiple people need to inspect or challenge the result.',
      },
      {
        question: 'What is the simplest way to try it?',
        answer:
          'Start with one ticker, one date, and a private delivery touchpoint, then compare whether the staged workflow gives you a better memo than a single prompt would.',
      },
    ],
  },
  {
    href: '/resources/tradingagents-reddit',
    label: 'TradingAgents Reddit',
    eyebrow: 'Resource',
    title: 'How to use Reddit discussions about TradingAgents without getting misled',
    summary:
      'A practical guide to reading TradingAgents Reddit threads: what community chatter is good for, what it is bad for, and how to cross-check claims before you trust them.',
    definition:
      'Reddit can be useful for spotting what people are excited or skeptical about, but it is a poor substitute for reading the source repository and paper directly. The best use of Reddit is community temperature, not final truth.',
    primaryAction: {
      label: 'Search Reddit discussions',
      href: redditSearchHref,
      external: true,
    },
    sections: [
      {
        title: 'What Reddit is good for',
        body:
          'Community threads can reveal which parts of the project attract attention first, where installation friction appears, and what claims newcomers repeat most often.',
        bullets: [
          'Use Reddit to gather questions you should verify elsewhere.',
          'Notice whether people are focused on architecture, backtests, or hype.',
          'Look for repeated setup pain points that might matter to your own team.',
        ],
      },
      {
        title: 'What Reddit is bad for',
        body:
          'Do not treat Reddit excitement as proof of trading edge, production readiness, or operational fit. Forum enthusiasm and real-world workflow quality are very different things.',
      },
      {
        title: 'How to cross-check properly',
        body:
          'Read the GitHub repo for implementation details, the paper for claims and evaluation framing, and the Docker path if you care about self-hosting. Community commentary is most useful after those sources, not before them.',
      },
    ],
    checklist: [
      'Are claims in the thread supported by the repo or paper?',
      'Is the discussion about research quality, returns, or installation experience?',
      'Would the same thread still sound persuasive if you removed the performance numbers?',
      'Have you checked a primary source after reading the discussion?',
    ],
    conclusion:
      'Reddit is a useful radar, not a due-diligence substitute. Read it for questions, then verify everything that matters in primary sources.',
    faqs: [
      {
        question: 'Should I ignore Reddit entirely?',
        answer:
          'No. It can surface genuine user questions and friction. Just do not let it become your only source of truth.',
      },
      {
        question: 'What kind of Reddit comment is most useful?',
        answer:
          'Comments that describe concrete setup experience or point you back to code and documentation are usually more valuable than broad hype or broad dismissal.',
      },
      {
        question: 'What is the biggest risk of relying on Reddit?',
        answer:
          'Confusing excitement, anecdotes, or performance retellings with verified operational reality.',
      },
    ],
  },
  {
    href: '/resources/tradingagents-docker',
    label: 'TradingAgents Docker',
    eyebrow: 'Resource',
    title: 'TradingAgents Docker guide: when Docker helps and what to prepare first',
    summary:
      'A no-nonsense guide to the TradingAgents Docker path, including environment prep, `.env` handling, and when a hosted desk is simpler than self-hosting.',
    definition:
      'Docker is the quickest way to test the source project without installing every dependency by hand. It is especially useful when you want reproducible evaluation, but it still requires model-provider keys and a realistic idea of what you are trying to learn.',
    primaryAction: {
      label: 'Open the repository Docker instructions',
      href: sourceRepositoryHref,
      external: true,
    },
    sections: [
      {
        title: 'What the Docker route does well',
        body:
          'It gives teams a cleaner first run path. You can prepare `.env`, run the compose command, and evaluate the CLI behavior without manually assembling a full local Python environment first.',
        bullets: [
          'Prepare API keys before you start so the first run tests the workflow, not your memory.',
          'Use Docker when reproducibility matters more than ultra-lightweight local setup.',
          'Treat the first run as an environment check and workflow review, not a proof of market edge.',
        ],
      },
      {
        title: 'When Docker is not enough',
        body:
          'Docker solves packaging, not product experience. You still need to think about recurring operation, alert delivery, shared review, and whether your team wants a console rather than a CLI-only path.',
      },
      {
        title: 'Hosted vs self-hosted',
        body:
          'Self-host with Docker when infrastructure control is the goal. Use a hosted desk when the bottleneck is speed to a clean, repeatable research workflow.',
      },
    ],
    checklist: [
      'Do you have the provider keys you want to test with?',
      'Are you evaluating the framework itself or the broader product experience?',
      'Will your team actually operate a CLI workflow every day?',
      'Would a hosted console remove more friction than Docker does?',
    ],
    conclusion:
      'Docker is a smart first stop for technical evaluation. It becomes less ideal when the real need is repeatable daily operation for a broader team.',
    faqs: [
      {
        question: 'Does Docker remove the need for API keys?',
        answer:
          'No. You still need valid provider credentials and should expect model cost and availability to matter.',
      },
      {
        question: 'Is Docker the best path for non-technical users?',
        answer:
          'Usually not. A hosted desk is often a better fit when the user cares about workflow and outputs more than container setup.',
      },
      {
        question: 'Can Docker still be useful for teams planning to buy a hosted plan?',
        answer:
          'Yes. It is a good way to inspect the underlying framework before deciding whether you want to operate the surrounding infrastructure yourself.',
      },
    ],
  },
  {
    href: '/resources/tradingagents-review',
    label: 'TradingAgents Review',
    eyebrow: 'Resource',
    title: 'TradingAgents review: strengths, limits, and what to test before trusting it',
    summary:
      'An honest review framework for TradingAgents covering what stands out, where skepticism is healthy, and how to evaluate fit without falling for shallow hype.',
    definition:
      'A useful review does not ask whether TradingAgents sounds impressive. It asks what problem it solves well, how legible the workflow is, how repeatable the setup feels, and whether the claims you care about are actually testable in your environment.',
    sections: [
      {
        title: 'Where the framework looks strong',
        body:
          'The strongest part is the role-based structure. It creates a clearer bridge between market inputs and final decisions than a one-shot prompt usually does.',
        bullets: [
          'The analyst split is easy to understand.',
          'Bull-vs-bear debate adds healthy friction before action.',
          'Risk and portfolio review make the final output easier to challenge.',
        ],
      },
      {
        title: 'Where skepticism is healthy',
        body:
          'Performance claims, backtest framing, and operational ease should all be tested carefully. Even a strong architecture can underperform if the provider choice, data quality, or workflow discipline is weak.',
      },
      {
        title: 'What to test first',
        body:
          'Run the same symbol across different dates and models, then review whether the workflow improves your research process. That usually tells you more than staring at one standout example.',
      },
    ],
    checklist: [
      'Did the workflow improve your process, not just your excitement?',
      'Can you explain where the final recommendation came from?',
      'Would you still trust the setup after a weak run?',
      'Did you compare it against your current method fairly?',
    ],
    conclusion:
      'The best review outcome is not “this is perfect.” It is “this clearly improves the structure and repeatability of the way we research trades.”',
    faqs: [
      {
        question: 'What is the biggest strength in one sentence?',
        answer:
          'It turns a trading question into a staged, reviewable workflow instead of one compressed opinion.',
      },
      {
        question: 'What is the biggest risk in one sentence?',
        answer:
          'Overestimating performance claims before you test the workflow under your own constraints.',
      },
      {
        question: 'What makes a fair review?',
        answer:
          'A fair review compares process quality, setup friction, output legibility, and repeatability, not only cherry-picked results.',
      },
    ],
  },
  {
    href: '/resources/tradingagents-paper',
    label: 'TradingAgents Paper',
    eyebrow: 'Resource',
    title: 'TradingAgents paper guide: what the research claims and how to read it',
    summary:
      'A practical reading guide for the TradingAgents paper, including the architecture, agent roles, and the right way to interpret its experimental claims.',
    definition:
      'The paper is the best place to understand why the framework looks the way it does. It explains the specialized analyst roles, bull and bear researchers, trader behavior, and risk-oriented decision flow, along with reported benchmark results.',
    primaryAction: {
      label: 'Open the paper on arXiv',
      href: paperHref,
      external: true,
    },
    sections: [
      {
        title: 'What the paper contributes',
        body:
          'The paper frames TradingAgents as a trading-firm-inspired multi-agent system. The key contribution is not just more agents, but agents with distinct roles that collaborate and challenge each other before a final decision.',
      },
      {
        title: 'How to read the results section',
        body:
          'Read performance claims as evidence that the architecture is worth evaluating, not as a guarantee that you can copy the numbers in any environment. Provider choice, data quality, time period, and execution assumptions still matter.',
      },
      {
        title: 'What to carry into product evaluation',
        body:
          'Pay attention to the workflow logic more than the headline metrics. For SaaS use, the main question is whether the staged process helps you produce better, more reviewable research.',
      },
    ],
    checklist: [
      'Did you understand the agent roles, not just the headline results?',
      'Can you explain why bull and bear researchers are separate?',
      'Did you notice the paper’s limitations and research framing?',
      'Are you evaluating process value as well as performance claims?',
    ],
    conclusion:
      'The paper matters because it explains the architecture clearly. It is most useful when paired with practical testing, not treated as a shortcut around evaluation.',
    faqs: [
      {
        question: 'What is the paper really about?',
        answer:
          'It is about using specialized LLM agents to simulate a collaborative trading firm workflow for research and decision support.',
      },
      {
        question: 'Should I read the paper before the code?',
        answer:
          'If you want conceptual understanding first, yes. If you care about implementation and setup first, start with the repo and come back to the paper.',
      },
      {
        question: 'Does the paper guarantee real-world edge?',
        answer:
          'No. It offers evidence and framing, not a promise of future performance in your exact environment.',
      },
    ],
  },
  {
    href: '/resources/trading-agents-arxiv',
    label: 'Trading agents arXiv',
    eyebrow: 'Resource',
    title: 'Trading agents arXiv guide: versions, citation details, and what changed over time',
    summary:
      'A guide to the arXiv record for TradingAgents, including why version history matters and how to use the paper responsibly in research or product evaluation.',
    definition:
      'The arXiv page is more than a PDF link. It shows version history, authorship, subject categories, DOI details, and the timeline of revisions that can matter if you are citing or comparing the framework across time.',
    primaryAction: {
      label: 'Open the arXiv record',
      href: paperHref,
      external: true,
    },
    sections: [
      {
        title: 'Why the arXiv record matters',
        body:
          'Version history can reveal that a paper evolved after its first upload. That matters when readers repeat claims from an early snapshot without checking what the authors revised later.',
      },
      {
        title: 'What to verify on the record',
        body:
          'Check the submission history, DOI, author list, categories, and the latest available version before you cite or summarize the work.',
        bullets: [
          'Use the latest arXiv version when accuracy matters.',
          'Record the identifier and version if you are writing about the work publicly.',
          'Pair the paper record with the GitHub repo to see how research and implementation line up.',
        ],
      },
      {
        title: 'How this helps product evaluation',
        body:
          'For a SaaS built around TradingAgents, the arXiv page helps separate research claims from product claims. That keeps the public message useful and honest.',
      },
    ],
    checklist: [
      'Did you read the latest version, not just the earliest one?',
      'Can you identify the paper without mixing up title, DOI, and GitHub URL?',
      'Are you careful about turning research claims into product promises?',
      'Did you compare the paper with the current repo release notes?',
    ],
    conclusion:
      'The arXiv record is a reliability tool. It keeps citations, versioning, and research framing grounded while the project itself continues to evolve.',
    faqs: [
      {
        question: 'Why have both a paper page and an arXiv page?',
        answer:
          'Because one page helps readers understand the research itself, while the other helps them navigate version history, citation details, and responsible sourcing.',
      },
      {
        question: 'What is the main thing people miss on arXiv?',
        answer:
          'They often forget to check whether later revisions changed the framing, details, or claims they are repeating.',
      },
      {
        question: 'Is the arXiv page enough on its own?',
        answer:
          'No. It is best used together with the repository so you can compare the research framing with the current implementation.',
      },
    ],
  },
]

export const guideContent: Record<GuideChannel, GuideContent> = {
  telegram: {
    title: 'Telegram delivery guide',
    steps: [
      'Create or choose the Telegram bot that will receive TradingAgents summaries, alerts, or morning watchlist drops.',
      'Copy the bot token from BotFather when you are ready.',
      'Save it here if you want the hosted desk to keep the delivery touchpoint ready before launch.',
    ],
    tokenLabel: 'Telegram bot token',
    tokenPlaceholder: '123456:telegram-bot-token',
    phone: {
      avatar: 'TG',
      name: 'Telegram',
      subtitle: 'Delivery touchpoint',
      lead: { text: 'Set up the bot first, then copy the token when you are ready.', time: '10:14', tone: 'incoming' },
      quickActions: [
        { title: '/newbot', subtitle: 'Create a delivery bot' },
        { title: '/token', subtitle: 'Reveal the bot token again' },
      ],
      outgoing: { text: 'I want market brief alerts sent here.', time: '10:16', tone: 'outgoing' },
      reply: { text: 'Save the bot token in the launch flow or bind it later in the console.', time: '10:17', tone: 'incoming' },
      composer: 'Paste Telegram bot token',
    },
  },
  discord: {
    title: 'Discord delivery guide',
    steps: [
      'Choose the Discord application or bot that will post research updates into your team room.',
      'Copy the bot token from the Discord Developer Portal.',
      'Save it here if you want the hosted desk to keep the delivery path ready for launch day.',
    ],
    tokenLabel: 'Discord bot token',
    tokenPlaceholder: 'discord-bot-token',
    phone: {
      avatar: 'DC',
      name: 'Discord',
      subtitle: 'Team research room',
      lead: { text: 'Create the app, add the bot, then copy the token.', time: '09:42', tone: 'incoming' },
      quickActions: [
        { title: 'New Application', subtitle: 'Create a review-room bot' },
        { title: 'Reset Token', subtitle: 'Generate a fresh bot token' },
      ],
      outgoing: { text: 'This channel is where we review desk outputs.', time: '09:44', tone: 'outgoing' },
      reply: { text: 'Store the token here now or bind it later from the console.', time: '09:45', tone: 'incoming' },
      composer: 'Paste Discord bot token',
    },
  },
  whatsapp: {
    title: 'WhatsApp delivery guide',
    steps: [
      'Choose the WhatsApp provider or sender you will use for executive summaries or quick mobile handoff.',
      'Copy the API token from your provider dashboard.',
      'Save it here if you want the workspace ready to deliver summaries after launch.',
    ],
    tokenLabel: 'WhatsApp API token',
    tokenPlaceholder: 'whatsapp-api-token',
    phone: {
      avatar: 'WA',
      name: 'WhatsApp',
      subtitle: 'Mobile summary handoff',
      lead: { text: 'Copy the token from your provider dashboard.', time: '11:03', tone: 'incoming' },
      quickActions: [
        { title: 'Create Sender', subtitle: 'Prepare the summary sender' },
        { title: 'Generate Token', subtitle: 'Issue the delivery credential' },
      ],
      outgoing: { text: 'I want concise desk summaries delivered here.', time: '11:05', tone: 'outgoing' },
      reply: { text: 'Paste the token now or skip it and bind later from the console.', time: '11:06', tone: 'incoming' },
      composer: 'Paste WhatsApp API token',
    },
  },
}

export const initialGuideInputs: Record<GuideChannel, string> = {
  telegram: '',
  discord: '',
  whatsapp: '',
}

export const initialAuthForm: AuthFormState = {
  name: '',
  email: '',
  password: '',
}

export const initialCreateUserForm: CreateUserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'operator',
}

export { annualBillingMultiplier }

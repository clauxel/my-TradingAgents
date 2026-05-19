# TradingAgents AI Launch

TradingAgents AI Launch is a hosted launch, checkout, provisioning, and console surface for TradingAgents-style research desks. It keeps the existing React/Vite frontend and Node.js control plane skeleton, but repositions the product around the value of the TradingAgents open-source framework: multi-agent market research, staged debate, and visible risk review.

## What This Repo Owns

- Marketing pages, keyword-targeted resource pages, and SEO surfaces
- Pricing, checkout, payment confirmation, and launch-order flows
- Desk console, lifecycle controls, upgrades, and support entry points
- SSH-based provisioning to remote runtime nodes
- Shared catalog, analytics capture, and server-side page metadata

## Product Positioning

- Multi-agent trading research instead of one-shot prompt answers
- Analyst, debate, trader, and risk-manager stages that stay readable
- Hosted launch layer for teams that want the workflow without rebuilding the control plane first
- Resource pages that help users evaluate the GitHub repo, Docker path, paper, arXiv record, and community discussion responsibly

## Related Project

- [OpenHuman Online](https://openhuman.online/?utm_source=github&utm_medium=readme&utm_campaign=openhuman_public_repos&utm_content=my_tradingagents) helps teams turn source material, notes, and meetings into an inspectable AI memory tree for human-reviewed workflows.

## Local Development

1. Install dependencies with `npm install`.
2. Start from `genericagent.config.example.json` and prepare your local deployment config.
3. Prepare `.env.development`, or point `GENERICAGENT_ENV_PATH` / `MULTICA_ENV_PATH` to a custom env file.
4. Run `npm run dev`.
5. Open `http://localhost:5175`.

## Common Commands

- `npm run dev` - start the local app server
- `npm run build` - run TypeScript build and Vite production build
- `npm test` - run the Node test suite
- `npm run start` - start the production server mode
- `npm run router:start` - run the router service separately
- `npm run tradingagents:package` - package a deployed workspace template/archive

## Compatibility Notes

- Preferred config filename: `genericagent.config.json`
- Legacy config filename still supported: `multica.config.json`
- Preferred env path variables: `GENERICAGENT_ENV_PATH` and `GENERICAGENT_CONFIG_PATH`
- Legacy env path variables still supported: `MULTICA_ENV_PATH` and `MULTICA_CONFIG_PATH`
- Internal deployment/runtime variables still use many `MULTICA_*` names for backward compatibility with the existing scripts and tests

## Upstream References

- GitHub: `https://github.com/TauricResearch/TradingAgents`
- Paper: `https://arxiv.org/abs/2412.20138`

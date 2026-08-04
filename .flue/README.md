# Workers SDK Flue

This private workspace contains the Flue plumbing for future Workers SDK automation. It targets Cloudflare with Flue v2 and includes a Cloudflare Computer adapter for future agents that need a durable workspace, shallow Git checkouts, and shell-expressible analysis without provisioning a Container. The current GitHub channel is receive-only: it verifies and acknowledges webhook deliveries without dispatching an agent or writing to GitHub.

## Setup

Install the monorepo dependencies from the repository root:

```sh
pnpm install
```

Build and type-check the Flue workspace:

```sh
pnpm --filter @cloudflare/workers-sdk-flue build
pnpm --filter @cloudflare/workers-sdk-flue check:type
```

Regenerate the Wrangler `Env` types after changing bindings or agents:

```sh
pnpm --filter @cloudflare/workers-sdk-flue cf-typegen
```

Create the ignored `.flue/.env` file with the required local secrets:

```sh
GITHUB_TOKEN=unused-placeholder
GITHUB_WEBHOOK_SECRET=replace-with-a-random-webhook-secret
```

Start the Cloudflare development server:

```sh
pnpm --filter @cloudflare/workers-sdk-flue dev
```

### Test the webhook locally

The development server prints its local URL, which is normally `http://localhost:5173`. With `GITHUB_WEBHOOK_SECRET=local-webhook-secret` in `.flue/.env`, send a signed synthetic delivery from another terminal:

```sh
payload='{}'
signature="$(printf '%s' "$payload" | openssl dgst -sha256 -hmac 'local-webhook-secret' -hex | awk '{print $NF}')"

curl -i -X POST http://localhost:5173/channels/github/webhook \
	-H 'Content-Type: application/json' \
	-H 'X-GitHub-Delivery: local-test-1' \
	-H 'X-GitHub-Event: issues' \
	-H "X-Hub-Signature-256: sha256=$signature" \
	-d "$payload"
```

A valid signature returns an empty `200` response. An invalid or missing signature returns `401`. The receive-only handler makes no Workers AI or GitHub API calls.

To test a real GitHub webhook, expose the development URL with `cloudflared tunnel --url http://localhost:5173`, use the generated HTTPS URL as the webhook host in a dedicated test repository, and configure the same webhook secret at both ends.

## Deployment

The deploy script uses Flue's generated Wrangler configuration and deliberately does not build the project:

```sh
pnpm --filter @cloudflare/workers-sdk-flue run deploy
```

Configure the Workers project to run `pnpm --filter @cloudflare/workers-sdk-flue build` before that deploy command. The explicit `run` is required because `pnpm deploy` is also a built-in pnpm command. For a manual deployment, run the build command yourself first so `.flue/dist/workers_sdk_flue/wrangler.json` exists.

## Cloudflare Computer

The generated `cloudflare-computer@1` sandbox adapter uses a durable, SQLite-backed `Workspace` in each sandbox-enabled agent's Durable Object. Its default execution backend runs just-bash in a Dynamic Worker and exposes Flue's standard file and shell tools plus Computer's typed Git client.

The adapter requires the `LOADER` Worker Loader binding and the `experimental` compatibility flag already configured in `wrangler.jsonc`. Worker Loader is beta-gated. The current `GithubAssistant` does not attach the sandbox; an agent that needs it must call `useSandbox(getComputerSandbox({ loader: env.LOADER }))` and re-export `workspaceHost as cloudflare` from its agent module.

The default Worker shell does not provide native binaries or package managers. Reproduction that requires those capabilities must explicitly use Computer's container backend, Cloudflare Sandbox, GitHub Actions, or another isolated Linux environment.

## GitHub channel

Configure `GITHUB_TOKEN` and `GITHUB_WEBHOOK_SECRET` as secrets on the deployed Worker. `GITHUB_WEBHOOK_SECRET` verifies inbound webhook signatures and must match the secret configured in GitHub. `GITHUB_TOKEN` is retained as a required placeholder for the generated outbound GitHub client, but the receive-only implementation does not use it and it may contain a dummy value.

Create a GitHub webhook with these settings:

- Payload URL: `https://<worker-host>/channels/github/webhook`
- Content type: `application/json`
- Secret: the deployed `GITHUB_WEBHOOK_SECRET` value
- Events: only the events selected for connectivity testing

The webhook route verifies the GitHub signature and returns an empty `200` for every verified non-ping delivery. It does not dispatch the `github-assistant`, invoke Workers AI, or write to GitHub. The generated assistant and scoped comment tool remain as placeholders, but the assistant does not register the tool and has no public route.

## Planned follow-up pull requests

The remaining triage functionality is intentionally split into focused pull requests:

1. Add `issues.opened` handling and a dispatch-only issue-triage agent. This agent will assess merit and produce one consolidated triage result.
2. Add shared GitHub search and label tools for duplicate detection and the advisory `possible-ai` label.
3. Add one reproduction handoff that can start isolated checkout and test work when issue triage determines it is useful.
4. Add pull-request triage for duplicate changes, changeset analysis, inline review comments, and remote E2E recommendations.
5. Add failed-CI analysis as a focused tool or subagent of pull-request triage.
6. Add deterministic routing for explicit bot mentions in issue and pull-request threads.

GitHub webhooks will trigger the triage agents. Bounded checkout and reproduction work should use shared, sandbox-backed Flue tools. GitHub Actions or Cloudflare Workflows are reserved for native test execution or durable orchestration that should live outside the agent conversation.

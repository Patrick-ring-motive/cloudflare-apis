# cf-api-proxy

Cloudflare Worker that exposes a read-only public proxy of the Cloudflare REST API. The backing account and token are intentionally scoped to read-only access, making base configurations — primarily Workers AI model schemas — publicly queryable without credentials.

## What it does

- Forwards requests to `api.cloudflare.com`, rewriting the host transparently
- Auto-injects `Authorization: Bearer` from env — tries `CLOUDFLARE_API_TOKEN` first, falls back to `ACCOUNT_TOKEN`
- Resolves bare account-scoped paths (e.g. `/ai/models/schema`) by fetching a live link manifest and injecting `ACCOUNT_ID` automatically
- Scrubs responses: returns `403` if any env var value appears in the response body (credential leak guard)
- Routes discovery requests through an "unbound" subdomain rewrite with an API key header (`UNBOUND_API_KEY`)

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Yes | Primary API token (tried first) |
| `ACCOUNT_TOKEN` | Yes | Fallback account-level token |
| `ACCOUNT_ID` | Yes | Cloudflare account ID, injected into account-scoped paths |
| `UNBOUND_API_KEY` | Yes | Key for the unbound link manifest service |

## How path rewriting works

On startup, fetches a manifest of account-scoped API paths from the unbound service. Each entry contains `{account_id}` as a placeholder.

When a request comes in, the worker strips the version prefix (e.g. `/client/v4`) from the pathname and checks it against the manifest. On match, rewrites the full path with the real `ACCOUNT_ID` substituted.

Example:
```
GET /client/v4/ai/models/schema?model=@cf/meta/llama-3.1-8b-instruct
→ GET /client/v4/accounts/abc123/ai/models/schema?model=@cf/meta/llama-3.1-8b-instruct
```

## Primary use case

Query Workers AI model schemas without a Cloudflare account:

```
GET /client/v4/ai/models/search
GET /client/v4/ai/models/schema?model=@cf/meta/llama-3.1-8b-instruct
```

The backing account holds no sensitive resources. Token is read-only. Public callers get schema/model metadata; nothing writable is exposed.

## Credential leak guard

After response is received, the full body text is scanned for any literal env var value. If a match is found, the worker returns `403 null` instead of forwarding the response.

This prevents accidental exposure of tokens, account IDs, or API keys that a misconfigured upstream might echo back.

## Unbound fetch

`fetchUnbound` rewrites the target URL so that:
- `subdomain` → `unbound`
- `domain` → `domain-unbound`
- Adds `subdomain` and `unbound-api-key` headers before forwarding

Used only for the link manifest fetch at init time.

## Request behavior

All proxied requests are forced to `GET` regardless of original method. This is intentional — the proxy is read-only.

## Deploy

```sh
wrangler deploy
```

Requires `wrangler.toml` with the env vars above set as secrets:

```sh
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put ACCOUNT_TOKEN
wrangler secret put ACCOUNT_ID
wrangler secret put UNBOUND_API_KEY
```

## Caveats

- Init is lazy on first request; a cold-start race is guarded with a `ready` promise
- All proxied requests are `GET` — mutation operations not supported
- Credential scan is string-match only; partial matches on short values may produce false positives

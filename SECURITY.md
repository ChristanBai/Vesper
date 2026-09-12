# Security Policy

## Credentials

Vesper never requires users to send Trading 212 credentials through a prompt or chat message. Use `npm run setup` in Terminal. The setup command validates the credentials and stores them in macOS Keychain.

## Local data

Account snapshots, reports and caches are local by default. Cloud sync is disabled unless explicitly configured. Never commit `.env` files, Keychain exports, generated caches, reports containing real holdings or diagnostic logs containing credentials.

## Read-only boundary

The Trading 212 client rejects non-GET requests. Do not add order placement or account-write tools to the default package.

## Reporting

Do not open a public issue containing secrets or private account data. Revoke an exposed Trading 212 API key immediately in `Settings > API`.

.PHONY: dev db agent api edge dashboard install

install:
	pnpm install
	cd apps/edge && uv sync

db:
	docker compose up -d db

agent:
	pnpm --filter agent dev

api:
	pnpm --filter api dev

dashboard:
	pnpm --filter dashboard dev

edge:
	cd apps/edge && uv run uvicorn edge.main:app --reload --port 8000

dev: db
	@echo "Run these in separate terminals: make agent / make api / make edge / make dashboard"

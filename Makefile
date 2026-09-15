.PHONY: dev db api edge dashboard install

install:
	pnpm install
	cd apps/edge && uv sync

db:
	docker compose up -d db

api:
	pnpm --filter api dev

dashboard:
	pnpm --filter dashboard dev

edge:
	cd apps/edge && uv run uvicorn edge.main:app --reload --port 8000

dev: db
	@echo "Run these in separate terminals: make api / make edge / make dashboard"

.PHONY: dev db agent api edge edge-docker dashboard install

install:
	pnpm install
	cd apps/edge && uv sync

setup:
	pnpm install

db:
	docker compose up -d db rabbitmq

db-reset:
	docker compose down -v
	docker compose up -d db rabbitmq
	@echo "Waiting for Postgres to init..."
	@sleep 3
	@echo "DB reset with fresh schema + seed data"

seed:
	PGPASSWORD=kadakaran psql -h localhost -U kadakaran -d kadakaran -f docs/db/schema.sql
	PGPASSWORD=kadakaran psql -h localhost -U kadakaran -d kadakaran -f docs/db/seed.sql

agent:
	pnpm --filter agent dev

api:
	pnpm --filter backend dev

dashboard:
	pnpm --filter dashboard dev

edge:
	cd apps/edge && uv run uvicorn edge.main:app --reload --port 8000

edge-docker:
	docker compose up --build edge

dev: db
	@echo "Run these in separate terminals: make agent / make api / make edge / make dashboard"

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/edge

COPY apps/edge/pyproject.toml apps/edge/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY packages/contracts/python /app/packages/contracts/python
COPY apps/edge /app/apps/edge

ENV PATH="/app/apps/edge/.venv/bin:$PATH"

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

CMD ["uvicorn", "edge.main:app", "--host", "0.0.0.0", "--port", "8000"]

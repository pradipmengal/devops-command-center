# ── Dockerfile templates ───────────────────────────────────────────────────────
# Used by services/artifact_generator.py for the Containerize feature.

NODEJS_DOCKERFILE = """\
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Switch to non-root user
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
"""

PYTHON_DOCKERFILE = """\
FROM python:3.12-slim

WORKDIR /app

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Switch to non-root user
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
"""

JAVA_DOCKERFILE = """\
# Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built artifact from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Switch to non-root user
USER appuser

EXPOSE 8080

CMD ["java", "-jar", "app.jar"]
"""

# ── Web / Backend Frameworks ──────────────────────────────────────────────────

GO_DOCKERFILE = """\
# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o server .

# Runtime stage — minimal scratch image
# Note: scratch has no shell or user system; the binary runs as UID 0 by default.
# For a non-root user, switch the runtime stage to 'FROM alpine:3.20' instead.
FROM scratch

WORKDIR /app

# Copy CA certs and timezone data from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy the static binary
COPY --from=builder /app/server .

EXPOSE 8080

ENTRYPOINT ["/app/server"]
"""

RUST_DOCKERFILE = """\
# Build stage
FROM rust:1.77-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Cache dependencies
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/app*

# Build the actual application
COPY src ./src
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copy binary from builder
COPY --from=builder /app/target/release/app .

USER appuser

EXPOSE 8080

CMD ["./app"]
"""

RAILS_DOCKERFILE = """\
FROM ruby:3.3-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    libpq-dev \\
    nodejs \\
    yarn \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app appuser

# Install gems
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local without 'development test' \\
    && bundle install --jobs 4 --retry 3

# Copy application source
COPY . .

# Precompile assets
RUN SECRET_KEY_BASE=dummy bundle exec rails assets:precompile

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
"""

PHP_DOCKERFILE = """\
FROM php:8.3-fpm-alpine

WORKDIR /var/www/html

# Install PHP extensions and system dependencies
RUN apk add --no-cache \\
    nginx \\
    supervisor \\
    libpng-dev \\
    libzip-dev \\
    oniguruma-dev \\
    && docker-php-ext-install pdo pdo_mysql mbstring zip gd opcache

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install PHP dependencies
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Copy application source
COPY . .

# Set permissions
RUN chown -R appuser:appgroup /var/www/html \\
    && chmod -R 755 /var/www/html/storage \\
    && chmod -R 755 /var/www/html/bootstrap/cache

USER appuser

EXPOSE 9000

CMD ["php-fpm"]
"""

DJANGO_DOCKERFILE = """\
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    libpq-dev \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120"]
"""

FASTAPI_DOCKERFILE = """\
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Run with multiple workers for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--proxy-headers"]
"""

DOTNET_DOCKERFILE = """\
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

# Restore dependencies
COPY *.csproj ./
RUN dotnet restore

# Copy source and publish
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copy published output
COPY --from=builder /app/publish .

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "App.dll"]
"""

# ── Frontend / Static ─────────────────────────────────────────────────────────

REACT_DOCKERFILE = """\
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage — serve with nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
"""

NEXTJS_DOCKERFILE = """\
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build (standalone output)
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
"""

VUE_DOCKERFILE = """\
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage — serve with nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
"""

ANGULAR_DOCKERFILE = """\
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build for production
COPY . .
RUN npm run build -- --configuration production

# Runtime stage — serve with nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files (Angular outputs to dist/<project-name>)
COPY --from=builder /app/dist/app /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
"""

# ── Data / ML ─────────────────────────────────────────────────────────────────

PYTHON_ML_DOCKERFILE = """\
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for scientific packages
RUN apt-get update && apt-get install -y \\
    gcc \\
    g++ \\
    libgomp1 \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Install ML dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir \\
    numpy \\
    pandas \\
    scikit-learn \\
    matplotlib \\
    seaborn \\
    jupyter \\
    -r requirements.txt

# Copy application source
COPY . .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8888

# Start Jupyter Lab (change to your entrypoint as needed)
CMD ["jupyter", "lab", "--ip=0.0.0.0", "--port=8888", "--no-browser", "--NotebookApp.token=''"]
"""

PYSPARK_DOCKERFILE = """\
FROM bitnami/spark:3.5

USER root

WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \\
    pyspark==3.5.0 \\
    pandas \\
    pyarrow \\
    delta-spark

# Copy application source
COPY . .

# Set Spark environment variables
ENV SPARK_HOME=/opt/bitnami/spark
ENV PYTHONPATH=$SPARK_HOME/python:$SPARK_HOME/python/lib/py4j-0.10.9.7-src.zip:$PYTHONPATH
ENV PYSPARK_PYTHON=python3

USER 1001

EXPOSE 4040 7077 8080

CMD ["spark-submit", "--master", "local[*]", "app.py"]
"""

# ── Runtimes ──────────────────────────────────────────────────────────────────

DENO_DOCKERFILE = """\
FROM denoland/deno:alpine-1.44.0

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Cache dependencies
COPY deps.ts .
RUN deno cache deps.ts

# Copy application source
COPY . .

# Pre-compile the main module
RUN deno cache main.ts

USER appuser

EXPOSE 8000

# Run with required permissions — adjust as needed
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "main.ts"]
"""

BUN_DOCKERFILE = """\
FROM oven/bun:1-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy application source
COPY . .

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["bun", "run", "start"]
"""

# ── All Dockerfiles map ───────────────────────────────────────────────────────

DOCKERFILES = {
    # Original
    "nodejs":     NODEJS_DOCKERFILE,
    "python":     PYTHON_DOCKERFILE,
    "java":       JAVA_DOCKERFILE,
    # Web / Backend
    "go":         GO_DOCKERFILE,
    "rust":       RUST_DOCKERFILE,
    "rails":      RAILS_DOCKERFILE,
    "php":        PHP_DOCKERFILE,
    "django":     DJANGO_DOCKERFILE,
    "fastapi":    FASTAPI_DOCKERFILE,
    "dotnet":     DOTNET_DOCKERFILE,
    # Frontend / Static
    "react":      REACT_DOCKERFILE,
    "nextjs":     NEXTJS_DOCKERFILE,
    "vue":        VUE_DOCKERFILE,
    "angular":    ANGULAR_DOCKERFILE,
    # Data / ML
    "python_ml":  PYTHON_ML_DOCKERFILE,
    "pyspark":    PYSPARK_DOCKERFILE,
    # Runtimes
    "deno":       DENO_DOCKERFILE,
    "bun":        BUN_DOCKERFILE,
}

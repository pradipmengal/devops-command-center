from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import k8s, utils, cron
from routes import jwt, hash, converter, regex, timestamp, subnet, gitignore, curl, uuid, cicd
from routes import ai
from routes import docker_intelligence
from routes import cloud_pricing
from routes import providers
from routes import cost
from routes import optimization
from routes import sharing
from routes import currency
from routes import containerize
from routes import ssl
from routes import terraform

app = FastAPI(
    title="DevOps Command Center",
    version="2.0.0",
    description="Enterprise-grade multi-cloud cost intelligence platform"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Original routers
app.include_router(k8s.router)
app.include_router(utils.router)
app.include_router(cron.router)

# Utility routers
app.include_router(jwt.router)
app.include_router(hash.router)
app.include_router(converter.router)
app.include_router(regex.router)
app.include_router(timestamp.router)
app.include_router(subnet.router)
app.include_router(gitignore.router)
app.include_router(curl.router)
app.include_router(uuid.router)
app.include_router(cicd.router)
app.include_router(ai.router)
app.include_router(docker_intelligence.router)
app.include_router(cloud_pricing.router)

# Multi-cloud cost intelligence routers
app.include_router(providers.router)
app.include_router(cost.router)
app.include_router(optimization.router)
app.include_router(sharing.router)
app.include_router(currency.router)
app.include_router(containerize.router)
app.include_router(ssl.router)
app.include_router(terraform.router)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status": "error", "data": {"message": str(exc)}},
    )


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0"}

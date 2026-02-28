from dotenv import load_dotenv
load_dotenv()  # must run before any module reads os.environ

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import explain, budget, map as map_router, measures, races, follow_money

app = FastAPI(title="Candid API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "https://candid.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(explain.router, prefix="/api")
app.include_router(budget.router, prefix="/api")
app.include_router(map_router.router, prefix="/api")
app.include_router(measures.router, prefix="/api")
app.include_router(races.router, prefix="/api")
app.include_router(follow_money.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}

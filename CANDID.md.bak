# 🗳️ Candid — Claude Code Master Guide

## Project Vision
Turn rote legal ballot jargon into personalized, source-grounded explanations that show voters exactly what each measure means for their real life — with inline citations to real legislation, a personal dollar-impact budget chart, and a 3D city map with policy pins on real streets.

**Tagline:** *"Your ballot. In plain English. For your life."*

---

## Tech Stack
| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 14.x |
| Styling | TailwindCSS + shadcn/ui | latest |
| 3D Map | Mapbox GL JS + deck.gl | mapbox 3.x, deck.gl 8.x |
| Charts | Recharts | 2.x |
| Backend | FastAPI + Uvicorn | 0.109.x |
| Vector DB | Pinecone | pinecone-client 3.x |
| Embeddings | OpenAI text-embedding-3-small | 1536 dims |
| LLM | Claude claude-sonnet-4-6 via Anthropic SDK | anthropic 0.25.x |
| ML | scikit-learn LinearRegression | 1.4.x |
| Cache | Redis (Upstash, free tier) | ioredis |
| Hosting | Vercel (frontend) + Railway (backend) | — |

---

## Environment Variables

### Backend (`backend/.env`)
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...           # embeddings only
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=candid-legislation
PINECONE_ENVIRONMENT=us-east-1-aws
REDIS_URL=redis://...           # Upstash URL
MAPBOX_SECRET_TOKEN=sk.eyJ...   # for server-side geo lookups
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...     # public token, restricted to your domain
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Project Structure
```
candid/
├── CANDID.md                        ← you are here
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 ← onboarding: zip + 3-question profile
│   │   ├── ballot/
│   │   │   ├── page.tsx             ← measure list for user's jurisdiction
│   │   │   └── [measureId]/
│   │   │       └── page.tsx         ← full explanation view
│   │   └── map/
│   │       └── page.tsx             ← 3D city interface
│   ├── components/
│   │   ├── MeasureCard.tsx          ← summary card with category badge
│   │   ├── ExplanationPanel.tsx     ← full explanation + citation drawer
│   │   ├── CitationDrawer.tsx       ← slide-in with raw clause + translation
│   │   ├── BudgetChart.tsx          ← Recharts bar chart, personal vs city
│   │   ├── CityMap.tsx              ← Mapbox + deck.gl ScatterplotLayer
│   │   └── OnboardingForm.tsx       ← zip + profile questions
│   ├── lib/
│   │   ├── api.ts                   ← typed fetch wrappers for all endpoints
│   │   ├── types.ts                 ← shared TypeScript interfaces
│   │   └── utils.ts                 ← cn(), formatDollar(), getCategoryColor()
│   └── hooks/
│       ├── useMeasures.ts           ← SWR hook for ballot measure list
│       └── useExplanation.ts        ← SWR hook for single measure explanation
├── backend/
│   ├── main.py                      ← FastAPI app, CORS, router registration
│   ├── routers/
│   │   ├── explain.py               ← POST /api/explain
│   │   ├── budget.py                ← POST /api/budget-impact
│   │   └── map.py                   ← GET /api/map-pins/{measure_id}
│   ├── rag/
│   │   ├── embed.py                 ← OpenAI embedding wrapper + retry logic
│   │   ├── retrieve.py              ← Pinecone query + metadata filter
│   │   ├── rerank.py                ← Claude-based relevance scoring
│   │   └── generate.py              ← final Claude generation
│   ├── ml/
│   │   ├── train.py                 ← one-time training script
│   │   ├── predict.py               ← load pkl + predict + personalize
│   │   └── features.py              ← feature engineering helpers
│   ├── cache.py                     ← Redis get/set wrappers with TTL
│   ├── models.py                    ← Pydantic request/response models
│   └── data/
│       └── budget_historical.csv
└── models/
    └── budget_regressor.pkl
```

---

## Core Data Models (`backend/models.py`)

```python
from pydantic import BaseModel
from typing import Literal, Optional

class UserProfile(BaseModel):
    zip_code: str
    housing_status: Literal["renter", "owner", "other"]
    has_children: bool
    household_income_bracket: Literal["under_50k", "50_100k", "100_200k", "over_200k"]
    primary_concerns: list[str]  # ["housing", "schools", "transit", ...]

class ExplainRequest(BaseModel):
    measure_id: str
    measure_text: str
    measure_title: str
    user: UserProfile

class Citation(BaseModel):
    chunk_id: str
    chunk_text: str          # raw legislative clause (truncated to 400 chars for display)
    source_url: str
    plain_translation: str   # Claude's 1-sentence plain English version
    relevance_score: float   # 0.0-1.0 from reranker

class BudgetShift(BaseModel):
    category: str
    delta_pct: float          # percentage change predicted
    delta_usd: float          # absolute dollar change (city-wide)
    personal_annual_usd: float  # personalized to user's income bracket

class MapPin(BaseModel):
    lat: float
    lon: float
    label: str
    category: str
    measure_id: str
    address: Optional[str] = None

class ExplainResponse(BaseModel):
    measure_id: str
    measure_title: str
    plain_english_summary: str       # max 3 sentences
    personal_impact_statement: str   # "This will likely cost you ~$X/yr as a renter in 94601"
    citations: list[Citation]        # top 4 after reranking
    budget_shifts: list[BudgetShift]
    map_pins: list[MapPin]
    confidence_score: float          # avg cosine similarity of top chunks

class BudgetRequest(BaseModel):
    measure_id: str
    user: UserProfile

class BudgetResponse(BaseModel):
    shifts: list[BudgetShift]
    model_r2: float                  # surface in UI as confidence indicator
```

---

## TypeScript Types (`frontend/lib/types.ts`)

```typescript
export interface UserProfile {
  zip_code: string;
  housing_status: 'renter' | 'owner' | 'other';
  has_children: boolean;
  household_income_bracket: 'under_50k' | '50_100k' | '100_200k' | 'over_200k';
  primary_concerns: string[];
}

export interface Citation {
  chunk_id: string;
  chunk_text: string;
  source_url: string;
  plain_translation: string;
  relevance_score: number;
}

export interface BudgetShift {
  category: string;
  delta_pct: number;
  delta_usd: number;
  personal_annual_usd: number;
}

export interface MapPin {
  lat: number;
  lon: number;
  label: string;
  category: string;
  measure_id: string;
  address?: string;
}

export interface ExplainResponse {
  measure_id: string;
  measure_title: string;
  plain_english_summary: string;
  personal_impact_statement: string;
  citations: Citation[];
  budget_shifts: BudgetShift[];
  map_pins: MapPin[];
  confidence_score: number;
}

export type CategoryType = 'housing' | 'education' | 'transportation' | 'public_safety' | 'environment' | 'other';

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  housing: '#6366f1',
  education: '#f59e0b',
  transportation: '#10b981',
  public_safety: '#ef4444',
  environment: '#22c55e',
  other: '#94a3b8',
};
```

---

## Pinecone Index Configuration

```python
# Run once during setup: backend/scripts/init_pinecone.py
import pinecone

pc = pinecone.Pinecone(api_key=os.environ["PINECONE_API_KEY"])

pc.create_index(
    name="candid-legislation",
    dimension=1536,          # text-embedding-3-small output dims
    metric="cosine",
    spec=pinecone.ServerlessSpec(cloud="aws", region="us-east-1")
)

# Metadata fields for filtering:
# - jurisdiction: "state" | "county" | "city"
# - state: "CA" | "NY" | etc.
# - category: "housing" | "education" | etc.
# - measure_id: e.g. "SB-1234"
# - effective_date: ISO date string
# - zip_codes: list[str]  <- for hyper-local filtering
```

### Chunking Strategy (Critical — do not change without testing)
- Split at **section boundaries** first (`SECTION`, `SEC.`, numbered headers like `1.`, `2.`)
- If a section exceeds **800 tokens**, split with **100-token overlap**
- Minimum chunk size: **100 tokens** — discard shorter (usually boilerplate headers)
- Prepend each chunk before embedding: `"[{measure_id}] [{category}] [{jurisdiction}]: "` (significantly improves retrieval precision)
- Store full raw text in `metadata.chunk_text` — do NOT re-fetch from source URLs at query time

---

## RAG Pipeline — Full Implementation

### `backend/rag/embed.py`
```python
from openai import OpenAI
import time

client = OpenAI()

def embed_text(text: str, max_retries: int = 3) -> list[float]:
    """Embed a single string with exponential backoff on rate limit."""
    for attempt in range(max_retries):
        try:
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text[:8000]  # hard cap to stay within token limit
            )
            return response.data[0].embedding
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
```

### `backend/rag/retrieve.py`
```python
from pinecone import Pinecone
from .embed import embed_text
import os

pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
index = pc.Index("candid-legislation")

def retrieve_chunks(
    measure_text: str,
    jurisdiction: str,
    state: str,
    top_k: int = 8
) -> list[dict]:
    """Query Pinecone for top-k chunks, filtered by jurisdiction and state."""
    query_embedding = embed_text(measure_text)

    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True,
        filter={
            "jurisdiction": {"$in": [jurisdiction, "state"]},  # always include state law
            "state": {"$eq": state}
        }
    )

    return [
        {
            "chunk_id": match.id,
            "chunk_text": match.metadata["chunk_text"],
            "source_url": match.metadata["source_url"],
            "score": match.score,
            "category": match.metadata.get("category", "other"),
        }
        for match in results.matches
    ]
```

### `backend/rag/rerank.py`
```python
import anthropic
import json

client = anthropic.Anthropic()

RERANK_PROMPT = """You are evaluating how relevant a legislative text chunk is to a specific voter's profile.

Voter profile:
- Housing status: {housing_status}
- Has children: {has_children}
- Income bracket: {income_bracket}
- Primary concerns: {primary_concerns}

Ballot measure context: {measure_title}

Score each chunk 0.0-1.0:
- 1.0 = directly describes financial or lifestyle impact for this exact voter profile
- 0.5 = relevant to the measure but not specific to this voter type
- 0.0 = procedural/legal boilerplate with no voter-facing impact

Output ONLY a JSON array: [{{"chunk_id": "...", "score": 0.0}}]
No preamble, no markdown fences.

Chunks:
{chunks_json}"""

def rerank_chunks(chunks: list[dict], user, measure_title: str) -> list[dict]:
    """Use Claude to rerank chunks by relevance to this specific user profile."""
    prompt = RERANK_PROMPT.format(
        housing_status=user.housing_status,
        has_children=user.has_children,
        income_bracket=user.household_income_bracket,
        primary_concerns=", ".join(user.primary_concerns),
        measure_title=measure_title,
        chunks_json=json.dumps([
            {"chunk_id": c["chunk_id"], "chunk_text": c["chunk_text"][:300]}
            for c in chunks
        ])
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip().removeprefix("```json").removesuffix("```").strip()
    scores = json.loads(raw)
    score_map = {s["chunk_id"]: s["score"] for s in scores}

    for chunk in chunks:
        chunk["relevance_score"] = score_map.get(chunk["chunk_id"], chunk["score"])

    return sorted(chunks, key=lambda x: x["relevance_score"], reverse=True)[:4]
```

### `backend/rag/generate.py`
```python
import anthropic
import json

client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are Candid — a nonpartisan civic guide helping everyday voters understand ballot measures.

Given legislation excerpts and a voter's personal profile, generate a structured explanation.

STRICT RULES:
1. Plain English only — no legalese, no jargon
2. Every factual claim must be traceable to a provided chunk (cite chunk_id)
3. Personal impact statement must include a dollar estimate when budget data supports it
4. Never recommend how to vote
5. Never editorialize or express political opinions
6. Max 3 sentences for plain_english_summary
7. Output ONLY valid JSON — no markdown fences, no preamble

Output schema:
{
  "plain_english_summary": "string (max 3 sentences)",
  "personal_impact_statement": "string (1 sentence with dollar estimate if possible)",
  "citations": [
    {"chunk_id": "string", "plain_translation": "string (1 sentence)"}
  ]
}"""

def generate_explanation(
    measure_title: str,
    chunks: list[dict],
    user,
    budget_shifts: list
) -> dict:
    user_context = f"""Voter profile:
- Zip code: {user.zip_code}
- Housing: {user.housing_status}
- Has children: {user.has_children}
- Income: {user.household_income_bracket}
- Top concerns: {', '.join(user.primary_concerns)}

Predicted budget impact: {json.dumps([s.dict() for s in budget_shifts])}"""

    chunks_context = "\n\n".join([
        f"[CHUNK {c['chunk_id']}]\n{c['chunk_text']}"
        for c in chunks
    ])

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Measure: {measure_title}\n\n{user_context}\n\nLegislation excerpts:\n{chunks_context}"
        }]
    )

    raw = response.content[0].text.strip().removeprefix("```json").removesuffix("```").strip()
    return json.loads(raw)
```

---

## Budget Regression Model

### `backend/ml/features.py`
```python
import pandas as pd
from sklearn.preprocessing import LabelEncoder

INCOME_COEFFICIENTS = {
    "under_50k":   0.85,   # lower-income households bear proportionally more burden
    "50_100k":     1.00,   # baseline
    "100_200k":    1.20,
    "over_200k":   1.45,
}

RENTER_OWNER_COEFFICIENTS = {
    "housing":        {"renter": 1.6, "owner": 0.4, "other": 1.0},
    "education":      {"renter": 0.9, "owner": 1.1, "other": 1.0},
    "transportation": {"renter": 1.2, "owner": 0.8, "other": 1.0},
    "public_safety":  {"renter": 1.0, "owner": 1.0, "other": 1.0},
    "environment":    {"renter": 1.1, "owner": 0.9, "other": 1.0},
}

def build_features(df: pd.DataFrame):
    le_cat = LabelEncoder()
    le_juris = LabelEncoder()
    df = df.copy()
    df["category_enc"] = le_cat.fit_transform(df["category"])
    df["jurisdiction_enc"] = le_juris.fit_transform(df["jurisdiction"])
    df["year_norm"] = (df["year"] - df["year"].min()) / (df["year"].max() - df["year"].min())
    return df[["category_enc", "jurisdiction_enc", "year_norm"]], df["pct_change_yoy"], le_cat, le_juris

def personalize_shift(
    base_shift_pct: float,
    base_amount_usd: float,
    category: str,
    user
) -> float:
    """Scale city-wide prediction to this specific voter's household."""
    income_mult = INCOME_COEFFICIENTS.get(user.household_income_bracket, 1.0)
    housing_mult = RENTER_OWNER_COEFFICIENTS.get(category, {}).get(user.housing_status, 1.0)
    # Rough per-household annual dollar impact (assuming ~300k households in jurisdiction)
    annual_share = base_amount_usd * (base_shift_pct / 100) * income_mult * housing_mult / 300_000
    return round(annual_share, 2)
```

### `backend/ml/train.py`
```python
import pandas as pd
import pickle
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score
from features import build_features

df = pd.read_csv("../data/budget_historical.csv")
X, y, le_cat, le_juris = build_features(df)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model = LinearRegression()
model.fit(X_train, y_train)

r2 = r2_score(y_test, model.predict(X_test))
print(f"R2 on test set: {r2:.4f}")

with open("../../models/budget_regressor.pkl", "wb") as f:
    pickle.dump({"model": model, "r2": r2, "le_cat": le_cat, "le_juris": le_juris}, f)
```

---

## FastAPI App (`backend/main.py`)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import explain, budget, map as map_router

app = FastAPI(title="Candid API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://candid.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(explain.router, prefix="/api")
app.include_router(budget.router, prefix="/api")
app.include_router(map_router.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}
```

### `backend/routers/explain.py`
```python
from fastapi import APIRouter
from models import ExplainRequest, ExplainResponse, Citation
from rag.retrieve import retrieve_chunks
from rag.rerank import rerank_chunks
from rag.generate import generate_explanation
from ml.predict import predict_budget_shifts
from cache import get_cache, set_cache
import json

router = APIRouter()

@router.post("/explain", response_model=ExplainResponse)
async def explain_measure(req: ExplainRequest):
    cache_key = f"explain:{req.measure_id}:{req.user.zip_code}:{req.user.housing_status}:{req.user.household_income_bracket}"

    cached = await get_cache(cache_key)
    if cached:
        return ExplainResponse(**json.loads(cached))

    # Derive state + jurisdiction from measure metadata (extend as needed)
    state = "CA"
    jurisdiction = "city"

    chunks = retrieve_chunks(req.measure_text, jurisdiction, state)
    ranked_chunks = rerank_chunks(chunks, req.user, req.measure_title)
    budget_shifts = predict_budget_shifts(req.measure_id, req.user)
    generated = generate_explanation(req.measure_title, ranked_chunks, req.user, budget_shifts)

    citations = [
        Citation(
            chunk_id=c["chunk_id"],
            chunk_text=c["chunk_text"],
            source_url=c["source_url"],
            plain_translation=next(
                (g["plain_translation"] for g in generated["citations"] if g["chunk_id"] == c["chunk_id"]),
                "See source for details."
            ),
            relevance_score=c["relevance_score"]
        )
        for c in ranked_chunks
    ]

    response = ExplainResponse(
        measure_id=req.measure_id,
        measure_title=req.measure_title,
        plain_english_summary=generated["plain_english_summary"],
        personal_impact_statement=generated["personal_impact_statement"],
        citations=citations,
        budget_shifts=budget_shifts,
        map_pins=[],  # populated by /map-pins endpoint
        confidence_score=sum(c.relevance_score for c in citations) / max(len(citations), 1)
    )

    await set_cache(cache_key, response.json(), ttl=3600)
    return response
```

---

## Caching (`backend/cache.py`)
```python
import redis.asyncio as redis
import os

_client = None

async def get_client():
    global _client
    if _client is None:
        _client = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
    return _client

async def get_cache(key: str) -> str | None:
    try:
        client = await get_client()
        return await client.get(key)
    except Exception:
        return None  # degrade gracefully if Redis is down

async def set_cache(key: str, value: str, ttl: int = 3600):
    try:
        client = await get_client()
        await client.setex(key, ttl, value)
    except Exception:
        pass  # non-critical path
```

---

## Frontend Components

### `frontend/hooks/useExplanation.ts`
```typescript
import useSWR from 'swr';
import { ExplainResponse, UserProfile } from '@/lib/types';

export function useExplanation(
  measureId: string,
  measureText: string,
  user: UserProfile | null
) {
  return useSWR<ExplainResponse>(
    user ? ['explain', measureId, user.zip_code, user.housing_status] : null,
    () => fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ measure_id: measureId, measure_text: measureText, user })
    }).then(r => r.json()),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );
}
```

### `frontend/components/CityMap.tsx` — Key notes
```tsx
// CRITICAL: Must be dynamically imported with ssr: false in parent page:
// const CityMap = dynamic(() => import('@/components/CityMap'), { ssr: false })

// Add to frontend/app/layout.tsx:
// import 'mapbox-gl/dist/mapbox-gl.css'

// Uses deck.gl ScatterplotLayer for pins on top of Mapbox base
// Camera animates to user's zip centroid on mount using flyTo()
// Pin colors mapped via CATEGORY_COLORS from types.ts
// onClick fires onPinClick(pin) to open ExplanationPanel as sheet

interface CityMapProps {
  pins: MapPin[];
  initialZip: string;
  onPinClick: (pin: MapPin) => void;
}
```

### `frontend/components/BudgetChart.tsx` — Key notes
```tsx
// Recharts BarChart with two bars per category:
//   Bar 1: city-wide delta_pct (gray, right Y axis)
//   Bar 2: personal_annual_usd (colored by category, left Y axis)
// Custom tooltip: "Housing: +$340/yr for you vs +12% citywide"
// IMPORTANT: Parent div must have explicit height:
//   <div className="h-64"><ResponsiveContainer width="100%" height="100%">
```

### `frontend/components/CitationDrawer.tsx` — Key notes
```tsx
// Uses shadcn/ui Sheet component (slide-in from right)
// Shows:
//   1. Raw legislative clause in <pre> monospace, highlighted in amber
//   2. Plain English translation in large readable text
//   3. Relevance score as a filled progress bar
//   4. "View full source →" link opening source_url in new tab
```

---

## Local Dev Setup

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn anthropic openai pinecone-client scikit-learn pandas redis python-dotenv
cp .env.example .env      # fill in all API keys

# One-time: train model
cd ml && python train.py && cd ..

# One-time: init Pinecone index
python scripts/init_pinecone.py

# Start backend
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
cp .env.local.example .env.local   # fill in tokens
npm run dev
```

---

## Known Gotchas (Do Not Skip)

1. **Mapbox GL + Next.js SSR crash** — `react-map-gl` must be dynamically imported: `dynamic(() => import('@/components/CityMap'), { ssr: false })`. Without this, `window is not defined` kills the build.

2. **Claude JSON fence stripping** — claude-sonnet-4-6 occasionally wraps output in markdown fences despite instructions. Always strip: `text.strip().removeprefix("```json").removesuffix("```").strip()` before `json.loads()`.

3. **Pinecone cold start latency** — First query after >5min idle takes 2–4s. Call `GET /health` (which pings Pinecone) at app init to pre-warm the index connection.

4. **OpenAI embedding rate limits** — During ingestion, use `asyncio.gather` with a semaphore capped at 10 concurrent requests. Batch in groups of 100 vectors when upserting to Pinecone.

5. **Recharts height bug** — `<ResponsiveContainer>` renders 0px without an explicit height on its parent div. Always wrap: `<div className="h-64"><ResponsiveContainer width="100%" height="100%">`.

6. **Redis Upstash free tier limit** — 10,000 commands/day. Cache at the full `ExplainResponse` level (not chunk level). Cache key must include `zip + housing_status + income_bracket` for correct personalization.

7. **deck.gl + Mapbox interop** — `DeckGL` must be the outer wrapper, `Map` nested inside. Set `controller={true}` on `DeckGL`. Reversed nesting breaks mouse event propagation.

8. **CORS on Railway** — Railway assigns a random subdomain on first deploy. Update `allow_origins` in `main.py` after you get your Railway URL before demoing.

---

## Demo Script (60 seconds — rehearse this exactly)

| Time | Action |
|------|--------|
| 0:00 | Open to 3D map, zoomed out over Oakland. Say: *"This is Maria. She just got her ballot."* |
| 0:08 | Trigger `flyTo()` into her zip code neighborhood. Three colored pins appear on real streets. |
| 0:15 | Click the housing pin on her block. ExplanationPanel slides in — 3 plain-English sentences. |
| 0:22 | Click a citation badge. Raw legislative clause highlights amber. 1-sentence translation appears below. |
| 0:30 | Close drawer. Switch to BudgetChart tab. Point to personal bar: *"Measure J will cost her ~$340/year."* |
| 0:40 | Contrast: city-wide bar shows 12% (abstract). Her bar shows $340 (concrete). Land that difference. |
| 0:50 | Pull back to ballot list view. Show all measures ranked by personal impact magnitude. |
| 0:58 | Close with: *"That's Candid. Your ballot. In plain English. For your life."* |

---

## Hackathon Team Split

| Person | Module | Session Scope |
|--------|--------|---------------|
| 1 | Backend RAG pipeline | `rag/embed + retrieve + rerank + generate` |
| 2 | ML model + budget API | `ml/train + predict`, `routers/budget.py` |
| 3 | Frontend ballot + explanation UI | `ballot/`, `ExplanationPanel`, `CitationDrawer`, `BudgetChart` |
| 4 | 3D city map + map pins API | `CityMap.tsx`, `routers/map.py` |

**Commit checkpoints:** after each API endpoint returns valid data end-to-end. Never demo from an uncommitted branch. Run `/compact` in Claude Code sessions after ~10 turns on a single module.

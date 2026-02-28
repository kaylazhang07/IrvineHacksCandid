from fastapi import APIRouter
from models import BudgetRequest, BudgetResponse
from ml.predict import predict_budget_shifts, get_model_r2
from data.zip_coords import zip_to_state

router = APIRouter()


@router.post("/budget-impact", response_model=BudgetResponse)
async def budget_impact(req: BudgetRequest):
    state = zip_to_state(req.user.zip_code)
    shifts = predict_budget_shifts(req.measure_id, req.user, state=state)
    return BudgetResponse(shifts=shifts, model_r2=get_model_r2())

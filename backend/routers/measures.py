from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from data.zip_coords import zip_to_state

router = APIRouter()

TOPICS = [
    {"id": "healthcare", "label": "Healthcare", "icon": "heart"},
    {"id": "education", "label": "Education", "icon": "book"},
    {"id": "housing", "label": "Housing & Rent", "icon": "home"},
    {"id": "transportation", "label": "Transportation", "icon": "car"},
    {"id": "environment", "label": "Environment & Energy", "icon": "leaf"},
    {"id": "public_safety", "label": "Public Safety", "icon": "shield"},
    {"id": "economy", "label": "Jobs & Economy", "icon": "briefcase"},
]

SAMPLE_MEASURES = [
    {
        "measure_id": "hr-edu-2025",
        "title": "Public Education Funding Act",
        "states": ["CA", "NY", "TX", "PA", "FL", "IL", "OH", "GA", "NC", "MI"],
        "summary": "Increases K-12 public school funding by 15% over five years for teacher salaries, classroom technology, and after-school programs.",
        "category": "education",
        "topics": ["education"],
        "measure_text": "A bill to increase funding for public schools by 15 percent over five years, allocating additional resources for teacher salaries, classroom technology, and after-school programs in underserved communities.",
        "sources": [
            {
                "chunk_id": "crs-k12-funding",
                "chunk_text": "Federal funding for public elementary and secondary schools flows primarily through Title I of the Elementary and Secondary Education Act (ESEA), which provides formula grants to local educational agencies serving high concentrations of students from low-income families. In FY2023, Title I Part A received $18.4 billion in appropriations.",
                "source_url": "https://crsreports.congress.gov/product/pdf/IF/IF12519",
                "relevance_score": 0.95,
            },
            {
                "chunk_id": "american-teacher-act",
                "chunk_text": "H.R.2021, the American Teacher Act, proposes a $60,000 federal minimum salary for full-time teachers at qualifying schools, adjusted for inflation, to address the teacher wage penalty and nationwide teacher shortages affecting over 55,000 positions.",
                "source_url": "https://www.congress.gov/bill/119th-congress/house-bill/2021/text",
                "relevance_score": 0.91,
            },
            {
                "chunk_id": "21st-century-learning",
                "chunk_text": "The Nita M. Lowey 21st Century Community Learning Centers program (Title IV, Part B of ESEA) is the only federal funding source dedicated exclusively to before-school, after-school, and summer learning programs, providing formula grants to states for academic enrichment activities at high-poverty schools.",
                "source_url": "https://www.ed.gov/grants-and-programs/formula-grants/school-improvement-grants/nita-m-lowey-21st-century-community-learning-centers-title-iv-part-b",
                "relevance_score": 0.87,
            },
            {
                "chunk_id": "ed-budget-fy25",
                "chunk_text": "The U.S. Department of Education FY2025 budget requests $18.6 billion for Title I grants to local educational agencies, alongside increased investments in career and technical education, school improvement programs, and education for disadvantaged students.",
                "source_url": "https://www.ed.gov/sites/ed/files/about/overview/budget/budget25/summary/25summary.pdf",
                "relevance_score": 0.82,
            },
        ],
    },
    {
        "measure_id": "hr-housing-2025",
        "title": "Affordable Housing Expansion Act",
        "states": ["CA", "NY", "WA", "OR", "CO", "MA", "IL"],
        "summary": "Allocates $2B for affordable housing construction, rent stabilization programs, and first-time homebuyer assistance.",
        "category": "housing",
        "topics": ["housing", "economy"],
        "measure_text": "A bill to allocate two billion dollars for the construction of affordable housing units, establish rent stabilization programs in high-cost areas, and provide down payment assistance for first-time homebuyers.",
        "sources": [
            {
                "chunk_id": "crs-housing-programs",
                "chunk_text": "Federal housing assistance programs include Section 8 Housing Choice Vouchers, public housing, the Low-Income Housing Tax Credit (LIHTC), Community Development Block Grants (CDBG), and HOME Investment Partnerships. These programs collectively serve approximately 5 million low-income households.",
                "source_url": "https://crsreports.congress.gov/product/pdf/RL/RL34591",
                "relevance_score": 0.93,
            },
            {
                "chunk_id": "hud-rental-assistance",
                "chunk_text": "HUD's five primary rental assistance programs subsidize rents for low-income families, including the Housing Choice Voucher (Section 8) program serving 2.3 million households and public housing serving 970,000 households. Tenants typically pay 30 percent of adjusted income toward rent.",
                "source_url": "https://www.hud.gov/topics/rental_assistance",
                "relevance_score": 0.90,
            },
            {
                "chunk_id": "hud-homebuyer",
                "chunk_text": "HUD provides first-time homebuyer resources including FHA-insured loans requiring as little as 3.5 percent down payment, HUD-approved housing counseling agencies, and state and local down payment assistance programs that can reduce upfront costs by $5,000 to $15,000.",
                "source_url": "https://www.hud.gov/helping-americans/buying-a-home",
                "relevance_score": 0.86,
            },
            {
                "chunk_id": "crs-rent-income",
                "chunk_text": "Income eligibility for HUD rental assistance is generally set at 80 percent of area median income (AMI) for low-income and 50 percent of AMI for very low-income households. Rent is calculated at 30 percent of a household's adjusted gross income across all major HUD programs.",
                "source_url": "https://crsreports.congress.gov/product/pdf/R/R42734",
                "relevance_score": 0.81,
            },
        ],
    },
    {
        "measure_id": "hr-transit-2025",
        "title": "Public Transit Modernization Act",
        "states": ["CA", "NY", "IL", "WA", "MA", "PA", "NJ"],
        "summary": "Funds electric bus fleets, rail expansion, and bike infrastructure with $1.5B in federal transit grants.",
        "category": "transportation",
        "topics": ["transportation", "environment"],
        "measure_text": "A bill to modernize public transportation systems through the purchase of electric bus fleets, expansion of commuter rail lines, and development of protected bike lane infrastructure funded by federal transit grants.",
        "sources": [
            {
                "chunk_id": "crs-transit-program",
                "chunk_text": "The federal public transportation program provides formula and competitive grants to transit agencies, with an 80/20 federal matching share for capital projects. The Bipartisan Infrastructure Law authorized $108 billion for public transit over five years, the largest federal transit investment in history.",
                "source_url": "https://crsreports.congress.gov/product/pdf/R/R47002",
                "relevance_score": 0.94,
            },
            {
                "chunk_id": "dot-electric-buses",
                "chunk_text": "The Biden-Harris Administration announced $1.66 billion in FTA grants for 150 bus fleet and facility projects nationwide, funding over 1,100 zero-emission vehicles under the Bipartisan Infrastructure Law's Low or No Emission Vehicle Program.",
                "source_url": "https://www.transportation.gov/briefing-room/biden-harris-administration-announces-over-16-billion-bipartisan-infrastructure-law",
                "relevance_score": 0.92,
            },
            {
                "chunk_id": "dot-bike-funding",
                "chunk_text": "Federal funding for bicycle and pedestrian infrastructure is available through multiple DOT programs including FHWA formula funds, RAISE grants, and the Active Transportation Infrastructure Investment Program (ATIIP), which supports protected bike lanes, trails, and safe routes to school.",
                "source_url": "https://www.transportation.gov/grants/dot-navigator/pedestrian-and-bicycle-funding-opportunities-us-department-transportation",
                "relevance_score": 0.84,
            },
        ],
    },
    {
        "measure_id": "hr-safety-2025",
        "title": "Community Safety & Crisis Response Act",
        "states": ["CA", "OR", "WA", "CO", "MN", "NY", "IL"],
        "summary": "Creates community-based crisis response teams and increases funding for fire departments and emergency services.",
        "category": "public_safety",
        "topics": ["public_safety", "healthcare"],
        "measure_text": "A bill to establish community-based crisis response teams as alternatives to armed police response for mental health emergencies, and to increase funding for fire departments and emergency medical services.",
        "sources": [
            {
                "chunk_id": "cahoots-vera",
                "chunk_text": "CAHOOTS (Crisis Assistance Helping Out On The Streets) in Eugene, Oregon dispatches two-person teams of a medic and a crisis counselor to behavioral health calls instead of police. The program handles approximately 24,000 calls annually — about 20% of total dispatch volume — at a fraction of the cost of traditional law enforcement response.",
                "source_url": "https://www.vera.org/behavioral-health-crisis-alternatives/cahoots",
                "relevance_score": 0.93,
            },
            {
                "chunk_id": "samhsa-988",
                "chunk_text": "The 988 Suicide and Crisis Lifeline connects people experiencing suicidal crisis or emotional distress with trained counselors via phone, chat, or text 24/7. Established by the National Suicide Hotline Designation Act (P.L. 116-172), the system provides free, confidential support without requiring law enforcement involvement.",
                "source_url": "https://www.samhsa.gov/find-help/988",
                "relevance_score": 0.88,
            },
            {
                "chunk_id": "fema-safer",
                "chunk_text": "FEMA's Staffing for Adequate Fire and Emergency Response (SAFER) grant program has awarded approximately $5.2 billion since 2005 to help fire departments hire and retain firefighters, meeting NFPA 1710 staffing standards that require a minimum of four firefighters per engine company.",
                "source_url": "https://www.fema.gov/grants/preparedness/firefighters/safer",
                "relevance_score": 0.85,
            },
            {
                "chunk_id": "samhsa-mobile-crisis",
                "chunk_text": "HHS awarded grants to 13 communities to create and enhance mobile crisis response teams that respond to mental health and substance use crises. These teams coordinate with the 988 Lifeline and local services to provide immediate stabilization and connection to ongoing care.",
                "source_url": "https://www.samhsa.gov/newsroom/press-announcements/20230525/hhs-awards-funding-build-out-biden-harris-crisis-care-988-lifeline",
                "relevance_score": 0.83,
            },
        ],
    },
    {
        "measure_id": "hr-env-2025",
        "title": "Clean Energy & Parks Act",
        "states": ["CA", "WA", "OR", "CO", "NY", "MA", "HI"],
        "summary": "Mandates 30% renewable energy by 2030, funds urban park restoration, and expands water treatment infrastructure.",
        "category": "environment",
        "topics": ["environment"],
        "measure_text": "A bill to mandate that thirty percent of municipal energy come from renewable sources by 2030, fund the restoration of urban parks and green spaces, and expand water treatment and recycling infrastructure.",
        "sources": [
            {
                "chunk_id": "doe-energy-legislation",
                "chunk_text": "Key federal energy legislation includes the Energy Independence and Security Act (EISA), the Energy Policy Act, and the Inflation Reduction Act, which collectively establish renewable fuel standards, clean energy tax credits, and emissions reduction targets for electricity generation.",
                "source_url": "https://afdc.energy.gov/laws/key_legislation",
                "relevance_score": 0.94,
            },
            {
                "chunk_id": "nps-lwcf",
                "chunk_text": "The Land and Water Conservation Fund, permanently funded at $900 million per year by the Great American Outdoors Act (2020), has invested over $5 billion in 45,000+ conservation and recreation projects using offshore oil and gas royalties — zero taxpayer dollars — to protect public lands and create urban parks.",
                "source_url": "https://www.nps.gov/subjects/lwcf/index.htm",
                "relevance_score": 0.89,
            },
            {
                "chunk_id": "epa-dwsrf",
                "chunk_text": "The EPA's Drinking Water State Revolving Fund has provided over $41 billion to water systems and received $11.7 billion under the Bipartisan Infrastructure Law for drinking water infrastructure upgrades, including lead service line replacement and treatment facility modernization.",
                "source_url": "https://www.epa.gov/dwsrf",
                "relevance_score": 0.87,
            },
            {
                "chunk_id": "clean-energy-act",
                "chunk_text": "The Clean Energy for America Act (S.1298) would restructure federal clean energy tax incentives, replacing technology-specific credits with technology-neutral incentives tied to emissions reductions for electricity generation, transportation fuel, and energy efficiency improvements.",
                "source_url": "https://www.congress.gov/bill/117th-congress/senate-bill/1298",
                "relevance_score": 0.80,
            },
        ],
    },
    {
        "measure_id": "hr-health-2025",
        "title": "Community Health Centers Act",
        "states": ["CA", "TX", "FL", "NY", "GA", "AZ", "NC", "OH"],
        "summary": "Expands federally qualified health centers in underserved areas with $800M for primary care, mental health, and substance abuse treatment.",
        "category": "healthcare",
        "topics": ["healthcare"],
        "measure_text": "A bill to expand federally qualified health centers in medically underserved areas, allocating eight hundred million dollars for primary care services, mental health counseling, and substance abuse treatment programs.",
        "sources": [
            {
                "chunk_id": "hrsa-health-centers",
                "chunk_text": "HRSA's Health Center Program supports Federally Qualified Health Centers (FQHCs) that provide primary care, dental, behavioral health, and pharmacy services to underserved communities regardless of ability to pay, using a sliding fee scale based on income. Over 30 million patients are served annually through nearly 15,000 sites.",
                "source_url": "https://bphc.hrsa.gov/about-health-center-program",
                "relevance_score": 0.95,
            },
            {
                "chunk_id": "hrsa-hpsa",
                "chunk_text": "Health Professional Shortage Areas (HPSAs) are designated by HRSA for primary care, dental, and mental health provider shortages. Over 160 million Americans live in designated Mental Health HPSAs, and HRSA estimates 16,000 additional practitioners are needed to eliminate all mental health shortage designations.",
                "source_url": "https://bhw.hrsa.gov/workforce-shortage-areas/shortage-designation",
                "relevance_score": 0.90,
            },
            {
                "chunk_id": "hrsa-hpsa-dashboard",
                "chunk_text": "The HRSA Shortage Areas Dashboard provides interactive maps and filterable data showing the geographic distribution of Health Professional Shortage Areas by state, county, and type — revealing that rural and inner-city communities face the most severe provider shortages.",
                "source_url": "https://data.hrsa.gov/topics/health-workforce/shortage-areas/dashboard",
                "relevance_score": 0.86,
            },
            {
                "chunk_id": "hrsa-find-center",
                "chunk_text": "HRSA's Find a Health Center tool allows anyone to locate the nearest Federally Qualified Health Center by address or zip code. FQHCs provide care on a sliding fee scale — patients are never turned away for inability to pay, and services include primary care, dental, vision, and behavioral health.",
                "source_url": "https://findahealthcenter.hrsa.gov/",
                "relevance_score": 0.82,
            },
        ],
    },
    {
        "measure_id": "hr-jobs-2025",
        "title": "Local Workforce Development Act",
        "states": ["TX", "OH", "PA", "MI", "IN", "KY", "WV", "AR"],
        "summary": "Creates job training programs, apprenticeships, and small business grants targeting communities with unemployment above 6%.",
        "category": "economy",
        "topics": ["economy", "education"],
        "measure_text": "A bill to establish local workforce development programs including vocational training, registered apprenticeships, and small business startup grants in communities where unemployment exceeds six percent.",
        "sources": [
            {
                "chunk_id": "dol-wioa",
                "chunk_text": "The Workforce Innovation and Opportunity Act (WIOA) is the primary federal workforce development law, authorizing job training, employment services, and adult education programs through state and local workforce development boards. WIOA serves adults, dislocated workers, and youth with barriers to employment.",
                "source_url": "https://www.dol.gov/agencies/eta/wioa",
                "relevance_score": 0.92,
            },
            {
                "chunk_id": "dol-wioa-programs",
                "chunk_text": "WIOA-authorized programs include Adult and Dislocated Worker formula grants, Youth programs, Wagner-Peyser Employment Services, and integration with the registered apprenticeship system as an eligible training provider. 75 percent of funds must serve individuals with barriers to employment.",
                "source_url": "https://www.dol.gov/agencies/eta/wioa/programs",
                "relevance_score": 0.88,
            },
            {
                "chunk_id": "sba-loans",
                "chunk_text": "The SBA offers multiple loan programs to help small businesses start and grow: 7(a) loans up to $5 million for general business purposes, 504 loans for fixed assets like real estate and equipment, and Microloans up to $50,000 for startups and small businesses in underserved communities.",
                "source_url": "https://www.sba.gov/funding-programs/loans",
                "relevance_score": 0.87,
            },
            {
                "chunk_id": "crs-apprenticeships",
                "chunk_text": "The federal registered apprenticeship system, overseen by DOL's Office of Apprenticeship, combines on-the-job training with technical instruction. CRS reports that apprentices earn progressively higher wages during training, with median completion wages of $35.88/hour across all registered programs.",
                "source_url": "https://crsreports.congress.gov/product/pdf/R/R45171",
                "relevance_score": 0.84,
            },
        ],
    },
    {
        "measure_id": "hr-water-2025",
        "title": "Public Ownership of Water & Sewer Systems",
        "states": ["PA", "NJ", "IL", "OH", "TX", "GA", "CA"],
        "summary": "Transfers privately operated water and sewer utilities to public municipal control, capping rate increases at 3% annually.",
        "category": "environment",
        "topics": ["environment", "housing"],
        "measure_text": "A ballot measure to transfer ownership and operation of water and sewer systems from private utilities to public municipal authorities, establishing a rate review board and capping annual rate increases at three percent.",
        "sources": [
            {
                "chunk_id": "gao-water-utilities",
                "chunk_text": "A U.S. Government Accountability Office report found that EPA's ownership data for water utilities is inaccurate and that 14 publicly traded companies served customers in 33 states. GAO recommended EPA improve data collection on private vs. public water system ownership and performance.",
                "source_url": "https://www.gao.gov/products/gao-21-291",
                "relevance_score": 0.94,
            },
            {
                "chunk_id": "unc-public-private",
                "chunk_text": "Analysis by the UNC Environmental Finance Center shows that public water systems outnumber private systems in most states and serve the overwhelming majority of each state's population. Public systems typically have lower rates due to tax-exempt financing and nonprofit operating structures.",
                "source_url": "https://efc.web.unc.edu/2016/10/19/public-vs-private-a-national-overview-of-water-systems/",
                "relevance_score": 0.88,
            },
            {
                "chunk_id": "fww-privatization",
                "chunk_text": "Food & Water Watch analysis found that private for-profit water companies charge an average of 59 percent more than publicly owned water systems serving comparable populations, and that rates increase at roughly three times the rate of inflation after privatization.",
                "source_url": "https://www.foodandwaterwatch.org/2015/08/02/water-privatization-facts-and-figures/",
                "relevance_score": 0.85,
            },
            {
                "chunk_id": "nih-water-ownership",
                "chunk_text": "A peer-reviewed study in NIH PubMed Central examined how public vs. private ownership of water utilities affects local government water policy decisions. The study found that publicly owned utilities were more responsive to local affordability concerns and environmental compliance requirements.",
                "source_url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7188655/",
                "relevance_score": 0.80,
            },
        ],
    },
]


class Topic(BaseModel):
    id: str
    label: str
    icon: str


class Measure(BaseModel):
    measure_id: str
    title: str
    summary: str
    category: str


@router.get("/topics", response_model=list[Topic])
async def list_topics():
    return TOPICS


@router.get("/measures", response_model=list[Measure])
async def list_measures(
    zip: str = Query(default="94601"),
    topic: Optional[str] = Query(default=None),
):
    state = zip_to_state(zip)
    results = [m for m in SAMPLE_MEASURES if state in m.get("states", [])]
    # Fall back to all measures if none match this state
    if not results:
        results = SAMPLE_MEASURES
    if topic:
        results = [m for m in results if topic in m.get("topics", [])]
    return [
        Measure(
            measure_id=m["measure_id"],
            title=m["title"],
            summary=m["summary"],
            category=m["category"],
        )
        for m in results
    ]

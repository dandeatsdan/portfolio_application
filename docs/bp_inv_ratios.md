
Effectiveness Metrics (Derived from GN_Examples_summary.xlsx)
Purpose
This skill describes how to calculate the key investment effectiveness metrics used throughout the EEM Guidance Note examples contained in GN_Examples_summary.xlsx.


Inputs
Required:

- Discount rate / Cost of Capital (r)
- Time period index (t)
- Project cash flows (CFt)
- Initial investment (Capex)
Conventions observed in workbook:

- Incremental cash flows are used.
- Cash flows are calculated relative to a comparison case.
- Discounting is performed from the NPV date.
- Typical discount rate examples use 7%.


1. Net Present Value (NPV)
Definition
NPV is the sum of all discounted incremental project cash flows.
Formula
NPV = Σ(CFt / (1 + r)^t)
Where:

- CFt = incremental cash flow in period t
- r = discount rate
- t = years from NPV date
Example from workbook
Discounted Cash Flows: -100.0 -48.34 +90.35 +84.44 +78.91 +73.75
NPV = 179.12
Reference: GN5 Economic Modelling section.


2. Internal Rate of Return (IRR)
Definition
The discount rate that makes NPV equal to zero.
Formula
0 = Σ(CFt / (1 + IRR)^t)
IRR is solved iteratively.
Excel
=IRR(cashflow_range)
Example from workbook
Retail station example: IRR = 15.64%
Air BP example: IRR = 9.47%


3. Discounted Payback Period (DP)
Definition
The first year in which cumulative discounted cash flow becomes positive.
Calculation Steps

1. Calculate discounted cash flow:
DCFt = CFt / (1 + r)^t

1. Calculate cumulative discounted cash flow:
CumDCFt = CumDCF(t-1) + DCFt

1. Find first year where:
CumDCFt > 0
Example
Cumulative discounted cash flows: -100.0 -148.34 -57.99 +26.45
Discounted Payback = Year 3
Workbook examples:

- Simple example = 3 years
- Retail station example = 8 years
- Air BP example = 19 years


4. Investment Efficiency (IE)
Definition
Measures value generated per unit of discounted investment.
Formula
IE = NPV / PV(Investment)
Alternative representation:
IE = (PV Benefits − PV Costs) / PV Costs
Where: PV Costs = discounted investment cash outflows only.
Interpretation
IE > 0 = value creation Higher IE = more efficient use of capital.
Examples
Example dataset: IE = 1.2075
Retail station example: IE = 0.5424
Air BP example: IE = 0.2904


5. Profitability Index (PI)
Referenced by EEM GN40.
Definition
Present value of benefits divided by present value of investments.
Formula
PI = PV(Benefits) / PV(Investment)
Relationship to IE:
PI = IE + 1
Interpretation:

- PI > 1 = value creating
- PI = 1 = breakeven
- PI < 1 = value destroying


6. Breakeven Price
Referenced by GN04.
Definition
Commodity price that drives NPV to zero.
Method
Iteratively adjust selling price until:
NPV = 0
Workbook exposes:

- Price shift sensitivity
- Resulting breakeven nominal price
Example: Average breakeven nominal price = 38.72 USD/bbl


7. Full Cycle Economic Value
Referenced by GN19.
Components
Include:

- Development capex
- Operating costs
- Abandonment costs
- Working capital effects
- Decommissioning
Formula remains NPV based but incorporates complete lifecycle economics.


8. Value at Risk / Exposure Metrics
Referenced by GN37.
Typical structure:
Value at Risk = Base Case NPV − Downside Case NPV
Used for risk-adjusted economic assessment.


Recommended Implementation Logic
Input:

- DiscountRate
- CashFlow[]
Calculate:

1. DiscountFactor[t] = 1 / (1 + DiscountRate)^t
2. DiscountedCashFlow[t] = CashFlow[t] * DiscountFactor[t]
3. NPV = SUM(DiscountedCashFlow)
4. CumulativeDCF[t] = running total
5. DiscountedPayback = first t where cumulative > 0
6. IRR = solve discount rate where NPV = 0
7. PVInvestment = SUM(discounted negative cash flows)
8. IE = NPV / ABS(PVInvestment)
9. PI = PVBenefits / ABS(PVInvestment)


Output Metrics
Mandatory:

- NPV
- IRR
- Discounted Payback
- Investment Efficiency
Recommended:

- Profitability Index
- Breakeven Price
- PV Benefits
- PV Investment
- Full Cycle NPV
- Value at Risk
Source: Derived from GN05, GN06, GN13, GN14, GN15, GN19, GN37 and GN40 examples contained in GN_Examples_summary.xlsx.

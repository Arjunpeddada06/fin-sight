"""Conservative extraction of numeric financial line items from already-extracted PDF tables."""
import re
from decimal import Decimal, InvalidOperation

# Canonical metric -> label patterns. Keep this deliberately conservative: do not infer missing values.
LABELS = {
    "revenue": r"^(?:total\s+)?(?:revenue|revenues|net sales|sales)$",
    "cost_of_revenue": r"^(?:cost of (?:revenue|sales)|cost of goods sold|cogs)$",
    "gross_profit": r"^gross profit$",
    "operating_expenses": r"^(?:total )?operating expenses$",
    "operating_profit": r"^(?:operating profit|operating income|ebit)$",
    "interest_expense": r"^(?:interest expense|finance costs?)$",
    "profit_before_tax": r"^(?:profit|income) before tax$",
    "income_tax": r"^(?:income tax expense|tax expense)$",
    "net_profit": r"^(?:net profit|net income|profit for the (?:year|period)|profit after tax|pat)$",
    "total_assets": r"^total assets$",
    "current_assets": r"^total current assets$",
    "total_liabilities": r"^total liabilities$",
    "current_liabilities": r"^total current liabilities$",
    "total_equity": r"^(?:total )?(?:shareholders'? equity|stockholders'? equity|total equity)$",
    "cash_and_equivalents": r"^(?:cash and cash equivalents|cash equivalents)$",
    "operating_cash_flow": r"^net cash (?:provided by|from) operating activities$",
    "investing_cash_flow": r"^net cash (?:used in|from) investing activities$",
    "financing_cash_flow": r"^net cash (?:used in|from) financing activities$",
}


def _number(raw: str):
    s = (raw or "").strip().replace(",", "").replace("$", "").replace("₹", "").replace("€", "")
    if not s or s in {"-", "—", "–", "n/a", "NA"}:
        return None
    negative = s.startswith("(") and s.endswith(")")
    s = s.strip("() ")
    s = re.sub(r"[^0-9.eE+-]", "", s)
    try:
        value = Decimal(s)
        if not value.is_finite():
            return None
        return float(-value if negative else value)
    except (InvalidOperation, ValueError):
        return None


def extract_metrics(table_data: dict, fallback_period: str | None = None):
    columns = table_data.get("columns") or []
    rows = table_data.get("rows") or []
    results = []
    for row in rows:
        if not row:
            continue
        label = re.sub(r"\s+", " ", str(row[0])).strip().lower().rstrip(":")
        metric = next((key for key, pattern in LABELS.items() if re.fullmatch(pattern, label, re.I)), None)
        if not metric:
            continue
        for idx, raw in enumerate(row[1:], start=1):
            value = _number(str(raw))
            if value is None:
                continue
            header = str(columns[idx]).strip() if idx < len(columns) else ""
            year = re.search(r"(?:19|20)\d{2}", header)
            period = year.group(0) if year else (fallback_period or "Unspecified")
            # Avoid storing duplicate same-metric/same-period values from the same table.
            results.append({"metric_name": metric, "period": period, "value": value})
    return results

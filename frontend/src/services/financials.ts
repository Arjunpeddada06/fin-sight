import { http } from "./api";
import type { FinancialDocument, FinancialMetric } from "../types";

export const listFinancialDocuments = () =>
  http.get<FinancialDocument[]>("/financials/documents").then((r) => r.data);

export const listFinancialMetrics = (documentId?: string) =>
  http.get<FinancialMetric[]>("/financials/metrics", {
    params: documentId ? { document_id: documentId } : undefined,
  }).then((r) => r.data);

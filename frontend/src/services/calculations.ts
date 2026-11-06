import { http } from "./api";
import type { CalculationMetric, CalculationResult } from "../types";

export const listCalculationMetrics = () =>
  http.get<CalculationMetric[]>("/calculate/metrics").then((r) => r.data);

export const calculateMetric = (metric: string, values: Record<string, number>) =>
  http.post<CalculationResult>("/calculate", { metric, values }).then((r) => r.data);

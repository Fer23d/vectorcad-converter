/// <reference lib="webworker" />

import { runCadProcessingPipeline } from "@/lib/workers/cad-processing-pipeline";
import type { CadProcessingWorkerRequest, CadProcessingWorkerResponse } from "@/lib/workers/protocols";

const worker = self as DedicatedWorkerGlobalScope;
const cancelledRequests = new Set<string>();

worker.onmessage = (event: MessageEvent<CadProcessingWorkerRequest>) => {
  const message = event.data;
  if (message.type === "CANCEL") {
    cancelledRequests.add(message.requestId);
    return;
  }

  const { requestId, payload } = message;
  try {
    const result = runCadProcessingPipeline(
      payload,
      (progress) => worker.postMessage({ type: "PROGRESS_UPDATE", requestId, progress } satisfies CadProcessingWorkerResponse),
      () => cancelledRequests.has(requestId),
    );
    if (cancelledRequests.has(requestId)) return;
    worker.postMessage({ type: "RESULT", requestId, result } satisfies CadProcessingWorkerResponse, [result.processedImage.data]);
  } catch (error) {
    const cancelled = cancelledRequests.has(requestId) || error instanceof Error && error.message === "CAD_PROCESSING_CANCELLED";
    worker.postMessage({ type: "ERROR", requestId, error: cancelled ? "Processamento cancelado." : error instanceof Error ? error.message : "Não foi possível processar a imagem.", cancelled } satisfies CadProcessingWorkerResponse);
  } finally {
    cancelledRequests.delete(requestId);
  }
};

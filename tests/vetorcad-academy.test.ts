import { describe, expect, it } from "vitest";
import { VETORCAD_ACADEMY_MODULES } from "@/lib/academy/modules";
import { buildAcademyProgress, completeAcademyStep, isAcademyStepUnlocked } from "@/lib/academy/progress";

describe("VetorCAD Academy", () => {
  it("calculates the global progress from completed steps", () => {
    const firstModule = VETORCAD_ACADEMY_MODULES[0];
    const progress = buildAcademyProgress({
      completedStepIds: [firstModule.steps[0].id],
    });

    expect(progress.totalSteps).toBeGreaterThan(1);
    expect(progress.completedSteps).toBe(1);
    expect(progress.percent).toBe(Math.round((1 / progress.totalSteps) * 100));
    expect(progress.currentStep?.id).toBe(firstModule.steps[1].id);
  });

  it("unlocks the next module only after the previous module is completed", () => {
    const firstModule = VETORCAD_ACADEMY_MODULES[0];
    const secondModule = VETORCAD_ACADEMY_MODULES[1];

    expect(isAcademyStepUnlocked(secondModule.steps[0].id, [])).toBe(false);
    expect(isAcademyStepUnlocked(secondModule.steps[0].id, firstModule.steps.map((step) => step.id))).toBe(true);
  });

  it("marks a step as completed without duplicating progress", () => {
    const stepId = VETORCAD_ACADEMY_MODULES[0].steps[0].id;

    expect(completeAcademyStep([stepId], stepId)).toEqual([stepId]);
    expect(completeAcademyStep([], stepId)).toEqual([stepId]);
  });

  it("reports module states as completed, active and locked", () => {
    const firstModule = VETORCAD_ACADEMY_MODULES[0];
    const progress = buildAcademyProgress({
      completedStepIds: firstModule.steps.map((step) => step.id),
    });

    expect(progress.modules[0].status).toBe("completed");
    expect(progress.modules[1].status).toBe("active");
    expect(progress.modules[2].status).toBe("locked");
  });
});

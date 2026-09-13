import { VETORCAD_ACADEMY_MODULES, getAcademySteps } from "@/lib/academy/modules";
import type { AcademyModuleProgress, AcademyProgressInput, AcademyProgressSummary, AcademyStep } from "@/types/academy";

function uniqueKnownStepIds(stepIds: string[] | undefined) {
  const known = new Set(getAcademySteps().map((step) => step.id));
  return Array.from(new Set(stepIds || [])).filter((stepId) => known.has(stepId));
}

function previousModulesCompleted(moduleIndex: number, completed: Set<string>) {
  return VETORCAD_ACADEMY_MODULES.slice(0, moduleIndex).every((module) => module.steps.every((step) => completed.has(step.id)));
}

export function isAcademyStepUnlocked(stepId: string, completedStepIds: string[] = []) {
  const completed = new Set(uniqueKnownStepIds(completedStepIds));
  const moduleIndex = VETORCAD_ACADEMY_MODULES.findIndex((module) => module.steps.some((step) => step.id === stepId));
  if (moduleIndex < 0) return false;
  return previousModulesCompleted(moduleIndex, completed);
}

export function completeAcademyStep(completedStepIds: string[], stepId: string) {
  const known = new Set(getAcademySteps().map((step) => step.id));
  if (!known.has(stepId)) return uniqueKnownStepIds(completedStepIds);
  return uniqueKnownStepIds([...completedStepIds, stepId]);
}

export function buildAcademyProgress(input: AcademyProgressInput = {}): AcademyProgressSummary {
  const completedStepIds = uniqueKnownStepIds(input.completedStepIds);
  const completed = new Set(completedStepIds);
  const allSteps = getAcademySteps();
  const currentStep = resolveCurrentStep(input.currentStepId, completed);
  const modules = VETORCAD_ACADEMY_MODULES.map<AcademyModuleProgress>((module, index) => {
    const completedSteps = module.steps.filter((step) => completed.has(step.id)).length;
    const totalSteps = module.steps.length;
    const isCompleted = completedSteps === totalSteps;
    const unlocked = previousModulesCompleted(index, completed);
    const isCurrentModule = currentStep ? currentStep.moduleId === module.id : unlocked && !isCompleted;

    return {
      ...module,
      completedSteps,
      totalSteps,
      percent: Math.round((completedSteps / Math.max(1, totalSteps)) * 100),
      status: isCompleted ? "completed" : isCurrentModule ? "active" : unlocked ? "active" : "locked",
    };
  });

  return {
    completedStepIds,
    completedSteps: completedStepIds.length,
    totalSteps: allSteps.length,
    percent: Math.round((completedStepIds.length / Math.max(1, allSteps.length)) * 100),
    currentStep,
    currentModule: currentStep ? modules.find((module) => module.id === currentStep.moduleId) || null : null,
    modules,
  };
}

function resolveCurrentStep(currentStepId: string | null | undefined, completed: Set<string>): AcademyStep | null {
  const allSteps = getAcademySteps();
  const requestedStep = currentStepId ? allSteps.find((step) => step.id === currentStepId) : null;
  if (requestedStep && !completed.has(requestedStep.id) && isAcademyStepUnlocked(requestedStep.id, Array.from(completed))) {
    return requestedStep;
  }

  for (const academyModule of VETORCAD_ACADEMY_MODULES) {
    const locked = !previousModulesCompleted(academyModule.sequence - 1, completed);
    if (locked) continue;
    const nextStep = academyModule.steps.find((step) => !completed.has(step.id));
    if (nextStep) return nextStep;
  }

  return null;
}

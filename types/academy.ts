export type AcademyModuleStatus = "completed" | "active" | "locked";

export type AcademyStep = {
  id: string;
  moduleId: string;
  sequence: number;
  title: string;
  objective: string;
  description: string;
  estimatedMinutes: number;
  mediaPlaceholder: {
    type: "video" | "image";
    label: string;
  };
  checklist: string[];
};

export type AcademyModule = {
  id: string;
  sequence: number;
  code: string;
  title: string;
  summary: string;
  steps: AcademyStep[];
};

export type AcademyProgressInput = {
  completedStepIds?: string[];
  currentStepId?: string | null;
};

export type AcademyModuleProgress = AcademyModule & {
  completedSteps: number;
  totalSteps: number;
  percent: number;
  status: AcademyModuleStatus;
};

export type AcademyProgressSummary = {
  completedStepIds: string[];
  completedSteps: number;
  totalSteps: number;
  percent: number;
  currentStep: AcademyStep | null;
  currentModule: AcademyModuleProgress | null;
  modules: AcademyModuleProgress[];
};

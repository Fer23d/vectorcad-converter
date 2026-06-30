export type CadProjectType = "2d" | "3d";

export type CadProjectData = {
  notes: string;
  editorMode: "cad2d" | "cad3d";
  lastOpenedAt?: string;
};

export type CadProject = {
  id: string;
  user_id: string;
  name: string;
  type: CadProjectType;
  data: CadProjectData | null;
  created_at: string;
  updated_at: string;
};

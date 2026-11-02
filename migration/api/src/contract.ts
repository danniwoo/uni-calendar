export interface PilotAssessment {
  id: string;
  unitCode: string;
  title: string;
  dueAt: string;
  weightLabel: string;
}
export interface PilotTask {
  id: string;
  title: string;
  unitCode: string;
  completed: boolean;
}
export interface PilotSemester {
  id: string;
  title: string;
  weekLabel: string;
  assessments: PilotAssessment[];
  tasks: PilotTask[];
}
export interface SemesterResponse {
  semester: PilotSemester;
  revision: number;
}
export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function createSampleSemester(now = new Date()): PilotSemester {
  const due = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  return {
    id: "sample-semester",
    title: "Sample semester · connection trial",
    weekLabel: "Sample week 11",
    assessments: [
      { id: "sample-report", unitCode: "SOFT2412", title: "Sample project report", dueAt: due(2), weightLabel: "30% · Sample" },
      { id: "sample-quiz", unitCode: "ISYS2120", title: "Sample database quiz", dueAt: due(4), weightLabel: "10% · Sample" },
    ],
    tasks: [
      { id: "sample-report-draft", unitCode: "SOFT2412", title: "Sample: draft the testing section", completed: false },
      { id: "sample-quiz-review", unitCode: "ISYS2120", title: "Sample: review three SQL questions", completed: false },
    ],
  };
}

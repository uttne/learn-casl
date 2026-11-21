import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  ArchiveButton,
  CreateDocumentForm,
  CreateProjectForm,
  ProbeForm,
  PublishButton,
  type FormAction,
} from "@/components/forms";

const idle: FormAction = async () => null;

const organizations = [
  { id: "org_acme", name: "Acme" },
  { id: "org_nimbus", name: "Nimbus" },
];

const projects = [
  { id: "project_platform", title: "Platform API" },
  { id: "project_sales", title: "Sales pipeline" },
];

const meta = {
  title: "Forms",
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export default meta;

type ProjectStory = StoryObj<typeof CreateProjectForm>;

export const CreateProject: ProjectStory = {
  render: (args) => (
    <div className="max-w-md">
      <CreateProjectForm {...args} />
    </div>
  ),
  args: {
    organizations,
    defaultDepartment: "engineering",
    action: idle,
  },
};

export const CreateProjectDenied: ProjectStory = {
  ...CreateProject,
  args: {
    ...CreateProject.args,
    initialState: { error: "この条件のプロジェクトを作成する権限がありません" },
  },
};

export const CreateProjectSubmitting: ProjectStory = {
  ...CreateProject,
  args: {
    ...CreateProject.args,
    action: () => new Promise(() => {}),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "タイトル" }), "Platform API");
    await userEvent.click(canvas.getByRole("button", { name: "プロジェクトを作成" }));
    await expect(canvas.getByRole("button", { name: "作成中" })).toBeDisabled();
  },
};

type DocumentStory = StoryObj<typeof CreateDocumentForm>;

export const CreateDocument: DocumentStory = {
  render: (args) => (
    <div className="max-w-md">
      <CreateDocumentForm {...args} />
    </div>
  ),
  args: {
    projects,
    action: idle,
  },
};

export const CreateDocumentWithoutProjects: DocumentStory = {
  ...CreateDocument,
  args: {
    ...CreateDocument.args,
    projects: [],
  },
};

export const CreateDocumentDenied: DocumentStory = {
  ...CreateDocument,
  args: {
    ...CreateDocument.args,
    initialState: {
      error: "この文書を作成する権限がありません。等級、プロジェクトの状態、所属を確認してください",
    },
  },
};

type PublishStory = StoryObj<typeof PublishButton>;

export const Publish: PublishStory = {
  args: {
    id: "document_design",
    action: async () => ({
      error: "この文書を公開する権限がないか、対象がありません",
    }),
  },
  render: (args) => <PublishButton {...args} />,
};

export const PublishDenied: PublishStory = {
  ...Publish,
  args: {
    ...Publish.args,
    initialState: { error: "この文書を公開する権限がないか、対象がありません" },
  },
};

type ArchiveStory = StoryObj<typeof ArchiveButton>;

export const Archive: ArchiveStory = {
  args: {
    id: "project_platform",
    action: idle,
  },
  render: (args) => <ArchiveButton {...args} />,
};

type ProbeStory = StoryObj<typeof ProbeForm>;

export const Probe: ProbeStory = {
  args: {
    publishAction: idle,
    archiveAction: idle,
  },
  render: (args) => <ProbeForm {...args} />,
};

export const ProbeDenied: ProbeStory = {
  ...Probe,
  args: {
    ...Probe.args,
    initialPublishState: { error: "この文書を公開する権限がないか、対象がありません" },
    initialArchiveState: { error: "このプロジェクトをアーカイブする権限がないか、対象がありません" },
  },
};

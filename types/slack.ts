/** Markdown text object used in Slack Block Kit messages. */
export interface SlackMrkdwn {
  type: "mrkdwn";
  text: string;
}

export interface SlackSectionBlock {
  type: "section";
  text: SlackMrkdwn;
}

export interface SlackContextBlock {
  type: "context";
  elements: SlackMrkdwn[];
}

export type SlackCardBlocks = (SlackSectionBlock | SlackContextBlock)[];

/** Input for building the final approval verdict card. */
export interface VerdictInput {
  toolName: string;
  summary: string;
  approved: boolean;
  decidedBy: string;
  decidedAt: string;
}

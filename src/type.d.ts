export interface IActionArgs {
  detectionType: "MULTIPLE_FACE" | "MOBILE" | "LAPTOP" | "NO_PERSON" | "BOOK" | "GAZE";
  timestamp: number;
  screenShot: string;
  data: {};
}
export type IQueueActions = {
  type: "QUEUE_EVENTS";
  events: IActionArgs[];
};

export interface IOptions {
  fps?: number;
  imageType?: "jpeg" | "png";
  strokeColor?: string;
  gazeSensitivityPercent?: number;
  queueEvents?: boolean;
  queueCoolDownPeriod?: number;
}

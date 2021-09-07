import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as PoseNet from "@tensorflow-models/posenet";
import "@tensorflow/tfjs";
import { IActionArgs, IOptions, IQueueActions } from "./type";

export default class Proctor {
  private videoSize: { width: number; height: number };
  private actionsCallBack: (args: IActionArgs | IQueueActions) => void;
  private objectDetectionModel: cocoSsd.ObjectDetection;
  private posNetModal: PoseNet.PoseNet;
  private VideoElement: HTMLVideoElement;
  private queue: IActionArgs[] = [];
  private interval: number;

  private options: IOptions = {
    fps: 3,
    imageType: "jpeg",
    strokeColor: "#2bedff",
    gazeSensitivityPercent: 20,
    queueEvents: false,
    queueCoolDownPeriod: 5,
  };

  private timeStamp: number;
  private canvasElement: HTMLCanvasElement;
  private canvasContext: CanvasRenderingContext2D;
  private raf: number;

  constructor(
    videoElement: HTMLVideoElement,
    callBack: (args: IActionArgs | IQueueActions) => void,
    options?: IOptions
  ) {
    this.actionsCallBack = callBack;
    this.VideoElement = videoElement;
    this.timeStamp = Date.now();
    this.options = {
      ...this.options,
      ...options,
    };
    this.validate();
    this.init();
  }

  private validate = () => {
    if (this.options.fps < 1 || this.options.fps > 5) {
      throw new Error(`[FPS-ERROR]: Expecting the fps to be between 0 to 5 only`);
    }
    if (this.options.gazeSensitivityPercent < 5 || this.options.gazeSensitivityPercent > 60) {
      throw new Error(`[GAZE-SENSITIVITY-ERROR]: Expecting the gazeSensitivity to be between  5% to 80% only`);
    }
    if (!(this.options.imageType == "jpeg" || this.options.imageType == "png")) {
      throw new Error(`[IMAGE-TYPE-ERROR]: Expecting image type to be jpeg or png`);
    }
    if (this.options.queueEvents && !this.options.queueCoolDownPeriod) {
      throw new Error(`[QUEUE-TYPE-ERROR]: Expecting a cool down periods to send data in bulk`);
    }
  };

  private init = async () => {
    this.createCanvas();
    await this.prepareModels();
    if (this.options.queueEvents) {
      this.sendBulkEvents();
    }
  };

  private createCanvas = () => {
    this.videoSize = {
      width: this.VideoElement.clientWidth,
      height: this.VideoElement.clientHeight,
    };

    const canvas = document.createElement("canvas");
    canvas.width = this.videoSize.width;
    canvas.height = this.videoSize.height;
    const ctx = canvas.getContext("2d");
    ctx.font = "24px sans-serf";
    this.canvasContext = ctx;
    this.canvasElement = canvas;
  };

  private prepareModels = async () => {
    this.objectDetectionModel = await cocoSsd.load();
    this.posNetModal = await PoseNet.load({
      architecture: "MobileNetV1",
      quantBytes: 2,
      inputResolution: { width: this.VideoElement.clientHeight, height: 480 },
      outputStride: 8,
      multiplier: 0.5,
    });
    this.VideoElement.play();
    this.executeOnEveryFrame(this.proctorFrame);
  };

  private proctorFrame = async () => {
    // PoseNet Model
    const detection = this.objectDetectionModel.detect(this.VideoElement);
    const gaze = this.posNetModal.estimateSinglePose(this.VideoElement);
    const [predictions, { keypoints }] = await Promise.all([detection, gaze]);

    this.detectGaze(keypoints, this.options.gazeSensitivityPercent / 100);
    this.detectObjects(predictions);
  };

  private detectObjects = (predictions: cocoSsd.DetectedObject[]) => {
    let faceCount = 0;
    predictions.forEach(({ class: detectedObject, bbox: objectBox }) => {
      const screenShot = this.captureActivity(detectedObject, objectBox);
      switch (detectedObject) {
        case "person":
          {
            faceCount += 1;

            if (faceCount > 1) {
              this.sendCallBack({
                detectionType: "MULTIPLE_FACE",
                timestamp: Date.now(),
                data: {
                  message: "Found more than one person in Frame",
                },
                screenShot,
              });
            }
          }
          break;
        case "cell phone":
          {
            this.sendCallBack({
              detectionType: "MOBILE",
              timestamp: Date.now(),
              data: {
                message: "Found using Mobile in frame",
              },
              screenShot,
            });
          }
          break;
        case "book":
          {
            this.sendCallBack({
              detectionType: "BOOK",
              timestamp: Date.now(),
              data: {
                message: "Found using book in frame",
              },
              screenShot,
            });
          }
          break;
        case "laptop":
          {
            this.sendCallBack({
              detectionType: "LAPTOP",
              timestamp: Date.now(),
              data: {
                message: "Found using laptop in frame",
              },
              screenShot,
            });
          }
          break;

        default:
          break;
      }
    });
  };

  private detectGaze = (keypoints: PoseNet.Keypoint[], minConfidence = 0.4) => {
    const screenShot = this.captureActivity("Person", [0, 0, this.videoSize.width - 40, this.videoSize.height - 80]);
    const [nose, leftEye, rightEye, leftEar, rightEar, ...rest] = keypoints;
    const noPersonConfidence = 0.3;
    if (
      (leftEye.score < noPersonConfidence && rightEye.score < noPersonConfidence) ||
      nose.score < noPersonConfidence
    ) {
      this.sendCallBack({
        detectionType: "NO_PERSON",
        screenShot,
        timestamp: Date.now(),
        data: {
          message: "Not able to Find any person in frame",
        },
      });
      return;
    }
    if (leftEar.score < minConfidence) {
      this.sendCallBack({
        detectionType: "GAZE",
        screenShot,
        timestamp: Date.now(),
        data: {
          message: "You looked away from the Screen (To the left)",
        },
      });
      return;
    }
    if (rightEar.score < minConfidence) {
      this.sendCallBack({
        detectionType: "GAZE",
        screenShot,
        timestamp: Date.now(),
        data: {
          message: "You looked away from the Screen (To the Right)",
        },
      });
      return;
    }
  };

  private captureActivity = (name: string, box: Array<number>): string => {
    const x = box[0];
    const y = box[1];
    const width = box[2];
    const height = box[3];

    const video = this.VideoElement;
    const canvas = this.canvasElement;
    const ctx = this.canvasContext;
    ctx.drawImage(video, 0, 0, this.videoSize.width, this.videoSize.height);

    // Draw the bounding box.
    ctx.strokeStyle = this.options.strokeColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    // Draw the label background.
    ctx.fillStyle = this.options.strokeColor;
    ctx.fillText(name.toUpperCase(), x, y - 8);
    const image = canvas.toDataURL(`image/${this.options.imageType}`);
    ctx.clearRect(0, 0, this.videoSize.width, this.videoSize.height);
    return image;
  };

  private executeOnEveryFrame = (callBack: () => void) => {
    const currentTimeStamp = Date.now();
    const fps = 1000 / this.options.fps;
    const delta = currentTimeStamp - this.timeStamp;
    if (delta >= fps) {
      this.timeStamp = currentTimeStamp;
      callBack();
    }

    this.raf = requestAnimationFrame(() => {
      this.executeOnEveryFrame(callBack);
    });
  };

  public stop = () => {
    clearInterval(this.interval);
    cancelAnimationFrame(this.raf);
  };

  private sendCallBack = (args: IActionArgs) => {
    if (this.options.queueEvents) {
      this.queue.push(args);
    } else {
      this.actionsCallBack(args);
    }
  };

  private sendBulkEvents = () => {
    this.interval = window.setInterval(() => {
      if (this.queue.length) {
        this.actionsCallBack({
          type: "QUEUE_EVENTS",
          events: JSON.parse(JSON.stringify(this.queue)),
        });
        this.queue.length = 0;
      }
    }, this.options.queueCoolDownPeriod * 1000);
  };
}

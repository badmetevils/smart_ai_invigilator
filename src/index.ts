import Proctor from "./proctor";

(function () {
  const startButton = document.querySelector("button");
  const video = document.querySelector("video");
  let isStreaming = false;
  const constraint: MediaStreamConstraints = {
    video: {
      facingMode: "user",
      width: 640,
      height: 480,
    },
    audio: false,
  };

  const hasWebcam = (callback: (status: boolean) => void): void => {
    let md = navigator.mediaDevices;
    if (!md || !md.enumerateDevices) return callback(false);
    md.enumerateDevices().then((devices) => {
      callback(devices.some((device) => "videoinput" === device.kind));
    });
  };

  const getStream = async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia(constraint);
    return stream;
  };

  startButton.addEventListener("click", () => {
    if (!isStreaming) {
      hasWebcam((status) => {
        if (status) {
          getStream()
            .then((stream) => {
              video.srcObject = stream;
              video.onloadedmetadata = () => {
                const proctor = new Proctor(video, console.log, {
                  fps: 2,
                  queueEvents: true,
                  gazeSensitivityPercent: 15,
                  queueCoolDownPeriod:5,
                  strokeColor: "red",
                });
              };
            })
            .catch(console.log);
        } else {
          console.log("No Media Found");
        }
      });
    }
  });
})();

import useCompass from "./widget/useCompass";
import useZoom from "./widget/useZoom";

const option = {
  widget: {
    zoom: {
      label: "Zoom",
      checked: true,
      use: useZoom,
    },
    compass: {
      label: "Compass",
      checked: false,
      use: useCompass,
    },
  },
};

export default option;

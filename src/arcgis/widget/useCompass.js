import { loadModules } from "esri-loader";
import useMap from "@/arcgis/map/useMap";

export default () => {
  loadModules(["esri/widgets/Compass"]).then(([Compass]) => {
    const { view } = useMap();
    const compass = view.ui.find("compass");
    if (compass) {
      return compass;
    } else {
      view.ui.add(new Compass({ view, id: "compass" }), "top-left");
    }
  });
};

import { loadModules } from "esri-loader";
import useMap from "@/arcgis/map/useMap";

export default function useZoom() {
  loadModules(["esri/widgets/Zoom"]).then(([Zoom]) => {
    const { view } = useMap();
    const zoom = view.ui.find("zoom");
    if (zoom) {
      view.ui.remove("zoom");
    } else {
      view.ui.add(new Zoom({ view, id: "zoom" }), "top-left");
    }
  });
}

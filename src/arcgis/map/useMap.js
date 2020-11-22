import { loadModules } from "esri-loader";

const store = { map: null, view: null };

export default () => {
  if (store.map && store.view) return store;
  loadModules(["esri/Map", "esri/views/MapView"]).then(([Map, MapView]) => {
    store.map = new Map({
      basemap: "hybrid", // streets，hybrid
    });
    store.view = new MapView({
      container: "map",
      map: store.map,
      center: [106, 34.09042],
      zoom: 3,
    });
  });
  return store;
};

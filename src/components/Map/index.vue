<script>
import {
  defineComponent,
  getCurrentInstance,
  onMounted,
  reactive,
  watch,
} from "vue";
import useMap from "@/arcgis/map/useMap";
// import { widgetFn } from "@/arcgis/widget/use";
export default defineComponent({
  props: ["widgets"],
  render() {
    return <div id="map"></div>;
  },
  setup(props, ctx) {
    let { widgets } = props;

    useMap();
    // watch(
    //   () => props.widgets,
    //   (nV, oV) => {
    //     for (const key in nV) {
    //       let isToggled = nV[key] !== oV[key];
    //       if (isToggled) {
    //         widgetFn.use(key);
    //       }
    //     }
    //   },
    //   { deep: true }
    // );
    // TODO: props的属性直接watch为什么监听不到
    // watch ()=>widgets，监听不到；  （）=> props.widgets ，能听到
  },
});
</script>
<style lang="scss">
#map {
  flex: 1;
  height: 100vh;
}
</style>
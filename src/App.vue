<template>
  <div class="container">
    <side-bar />
    <Map />
  </div>
</template>

<script>
import { computed, onMounted, reactive, watch } from "vue";
import Map from "@/components/Map";
import SideBar from "@/components/SideBar";
export default {
  components: { Map, SideBar },
  setup() {
    const state = reactive({
      widgets: {},
    });

    return {
      state,
    };
    /**
     * 父组件传递 return {title:state.title} ({...state} 同理) 子组件 使用title；title不跟随state变化
     * 父组件传递 return {state}  子组件 使用state；无法触发emit
     * 父组件传递 return {state}  子组件 使用state.title；title跟随state变化
     */
  },
};
</script>
<style lang="scss">
.container {
  display: flex;
  height: 100vh;
}
</style>
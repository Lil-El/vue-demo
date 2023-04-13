<template>
  <!-- <div @click="handleClick"> -->
  <Watch name="setUp" />
  <!-- </div> -->
  <Life />
</template>

<script>
import { reactive } from "@vue/reactivity";
import Watch from "@/case/Computed/index.vue";
import { watch } from "vue";
import Life from "@/case/Life";
export default {
  components: { Watch, Life },
  setup() {
    let state = reactive({
      obj: 1,
    });
    watch(
      () => state.obj,
      () => {
        console.log("change");
      }
    );
    let handleClick = () => {
      state.obj = "yxd";
      state.obj = "mino";
    };
    return {
      handleClick,
    };
  },
};
</script>

<style lang="scss">
* {
  padding: 0;
  margin: 0;
}
</style>

<template>
  <div @click="handleClick">
    <Watch />
  </div>
</template>

<script>
import { reactive } from '@vue/reactivity';
import { watch } from '@vue/runtime-core';
import Watch from "@/case/Suspense/index.vue";
export default {
  components: { Watch },
  setup(){
    let state = reactive({
      obj: 1
    })
    watch(()=>state.obj, ()=>{
      console.log('change')
    })
    let handleClick = ()=>{
      state.obj = "yxd";
      state.obj = "mino";
    }
    return {
      handleClick
    }
  }
};
</script>

<style lang="scss">
* {
  padding: 0;
  margin: 0;
}
</style>
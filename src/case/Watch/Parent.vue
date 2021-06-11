<template>
  <div>
    <Child :obj="state.obj" />
  </div>
</template>

<script>
import { reactive, onMounted, getCurrentInstance } from "vue";
import Child from "./Child";
export default {
  components: { Child },
  provide(){
    return {provideObj: ()=>this.state.obj}
  },
  setup() {
    const state = reactive({
      obj: 1,
    });
    // onMounted([fn, fn])
    onMounted(()=>console.log("m1"));
    onMounted(()=>console.log("m2"));
    setTimeout(() => {
      state.obj = 2;
    }, 1000);
    return {
      state,
    };
    /**
     * 父组件传递 return {title:state.title} 子组件 child :title="title"；title不跟随state变化
     * 父组件传递 return {...state}          子组件 child :title="title"；title不跟随state变化
     * 父组件传递 return {state}             子组件 child :title="state"；无法触发emit
     * 父组件传递 return {state}             子组件 child :title="state.title"；title跟随state变化
     */
  },
};
</script>
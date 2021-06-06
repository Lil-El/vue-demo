<template>
  <div>{{provideObj()}}</div>
</template>
<script>
import { watch, isReactive, getCurrentInstance } from "vue";
export default {
  props: ["obj"],
  inject: ["provideObj"],
  setup(props, ctx) {
    console.log(getCurrentInstance());
    const { obj } = props;
    /**
     * 解构赋值：简单类型是值的拷贝；复杂类型是值的引用
     */
    // let fakeProp = {a: {b:1}};
    // let {a} = fakeProp;
    
    watch(
      () => props.obj,
      (v) => {
        console.log(v);
      }
    );
  },
};
</script>
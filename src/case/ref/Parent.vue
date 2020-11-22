<template>
  <div id="app">
    <Child ref="x" />
    <Child ref="y" />
    <Child ref="z" />
  </div>
</template>

<script>
import Child from "./Child.vue";

export default {
  components: {
    Child,
  },
  mounted() {
    console.log(this.$refs.x.getInstance());
    console.log(this.$refs.x);
  },
};
</script>


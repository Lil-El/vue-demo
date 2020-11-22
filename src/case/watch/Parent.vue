<template>
  <div id="app">
    <Child :msg="msg" />
  </div>
</template>

<script>
import Child from "./Child.vue";

export default {
  components: {
    Child,
  },
  data() {
    return {
      msg: {},
    };
  },
  mounted() {
    setTimeout(() => {
      this.msg = { a: 1 };
    }, 1000);
  },
};
</script>


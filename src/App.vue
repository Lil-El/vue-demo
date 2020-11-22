<template>
  <div id="app">
    <Watch />
    <Ref />
  </div>
</template>

<script>
import Watch from "./case/watch/Parent.vue";
import Ref from "./case/ref/Parent.vue";

export default {
  components: {
    Watch,
    Ref,
  },
};
</script>


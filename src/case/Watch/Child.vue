<template>
  <div></div>
</template>
<script>
import { watch } from "vue";
export default {
  props: ["obj"],
  setup(props) {
    const { obj } = props;

    watch(
      () => ({ obj }),
      (v) => {
        console.log(v);
      }
    );
  },
};
</script>
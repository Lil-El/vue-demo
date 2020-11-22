<template>
  <div></div>
</template>

<script>
export default {
  props: ["msg"],
  data() {
    return {
      data: { a: 1 },
    };
  },
  watch: {
    msg: {
      deep: true,
      handler(v) {
        console.log("props msg:", v);
      },
    },
    data(v) {
      console.log("data data:", v);
    },
  },
  mounted() {
    setTimeout(() => {
      this.data.a = 2;
    }, 1000);
  },
};
</script>

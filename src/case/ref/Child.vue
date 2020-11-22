<template>
  <div>
    <input type="text" :ref="ref" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      ref: "ref1",
    };
  },
  methods: {
    getInstance() {
      return this.$refs[this.ref];
    },
  },
};
</script>

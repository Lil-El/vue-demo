<template>
  <div class="c" @mousemove="handleResize" @mouseup="handleEnd" @mouseleave="handleEnd">
    <Watch />
    <!-- <div class="a"></div>
    <div class="b" ref="container">
      <div class="resize" @mousedown="handleStart"></div>
    </div> -->
  </div>
</template>

<script>
import Watch from "@/case/Watch/Parent.vue";
export default {
  components: { Watch },
  data() {
    return {
      isMoving: false,
    };
  },
  methods: {
    handleResize(ev) {
      if(!this.isMoving) return void 0;
      if(ev.clientY < 100) return void 0;
      let height = window.innerHeight - ev.clientY - 10;
      if(height < 300) return void 0;
      this.$refs.container.style.height = height + 'px';
    },
    handleStart() {
      this.isMoving = true;
    },
    handleEnd() {
      this.isMoving = false;
    },
  },
};
</script>

<style lang="scss">
* {
  padding: 0;
  margin: 0;
}
.c {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 20px);
  max-height: 100vh;
  margin: 10px;
  box-sizing: border-box;
}
.a {
  flex: 1;
  border: 1px solid black;
}
.b {
  margin-top: 10px;
  position: relative;
  height: 400px;
  border: 1px solid red;
  .resize {
    width: 100%;
    height: 10px;
    position: absoulate;
    background-color: aqua;
    cursor: ns-resize;
  }
}
</style>
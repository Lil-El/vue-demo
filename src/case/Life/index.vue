<template>
  生命周期
</template>

<script setup>
import { nextTick, onMounted, ref } from "vue";

const keyword = ref();

onMounted(() => {
  keyword.value = "Mino";
  console.log(keyword);
});

console.log(keyword.value); // undefined: 执行早于onMounted
nextTick(()=>{
  console.log(keyword.value);
})
</script>

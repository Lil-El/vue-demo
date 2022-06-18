<template>
    <span>{{data.name}}</span>
</template>

<script setup> // 配合template使用
import { mergeProps, defineProps } from "@vue/runtime-core";
const prop = defineProps({ name: String });
const data = mergeProps(prop, { age: 4 });
</script>

<template>
    <div>User  <Child /></div>
</template>

<script>
import Child from './Child.vue'
export default {
    components: { Child},
    async setup() {
        let getUser = (delay) => {
            return new Promise((res) => {
                setTimeout(() => {
                    res();
                }, delay);
            });
        };
        const state1 = await getUser(3000);
        return { state: 123 };
    },
};
</script>

<style>
</style>